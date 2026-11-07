import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import localStore from "../local-store.cjs";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
const SITE = "https://large-files-test.example";
const INSTALL = "TEST-ONLY-large-file-installation-key";
const CHUNK = 2 * 1024 * 1024;
async function fixture() {
  const stores = memoryStores(),
    cookies = {};
  const config = {
    getStores: () => stores,
    origins: [SITE],
    setupKey: INSTALL,
  };
  const call = async (name, data, who = "admin", extra = {}) => {
    const url = name.startsWith("/") ? name : "/api/local/" + name;
    const response = await createNetlifyHandler(config)(
      new Request(SITE + url, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined
            ? {}
            : {
                "content-type": extra.binary
                  ? "application/octet-stream"
                  : "application/json",
              }),
          ...(cookies[who] ? { cookie: cookies[who] } : {}),
          ...extra.headers,
        },
        body:
          data === undefined
            ? undefined
            : extra.binary
              ? data
              : JSON.stringify(data),
      }),
      { ip: "192.0.2.15" },
    );
    const cookie = response.headers.get("set-cookie");
    if (cookie) cookies[who] = cookie.split(";")[0];
    const json = response.headers
      .get("content-type")
      ?.startsWith("application/json");
    return {
      status: response.status,
      headers: response.headers,
      data: json
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    };
  };
  assert.equal(
    (
      await call("setup", {
        setup_key: INSTALL,
        password: "TEST-ONLY-large-file-password!",
      })
    ).status,
    200,
  );
  const start = (mime, size, key = randomUUID(), who = "admin") =>
    call("upload-start", { mime, size, key }, who);
  const part = (id, index, bytes, who = "admin") =>
    call(`upload-part?id=${id}&index=${index}`, bytes, who, { binary: true });
  const finish = (id) => call("upload-finish", { id });
  const upload = async (mime, bytes) => {
    const transfer = await start(mime, bytes.length);
    assert.equal(transfer.status, 200);
    for (
      let offset = 0, index = 0;
      offset < bytes.length;
      offset += CHUNK, index++
    )
      assert.equal(
        (
          await part(
            transfer.data.id,
            index,
            bytes.subarray(offset, offset + CHUNK),
          )
        ).status,
        200,
      );
    const result = await finish(transfer.data.id);
    return { ...result, transfer: transfer.data };
  };
  return { stores, call, start, part, finish, upload };
}
test("large files require administrator access and enforce separate PDF/video size limits", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.start(
        "application/pdf",
        20 * 1024 * 1024,
        randomUUID(),
        "visitor",
      )
    ).status,
    403,
  );
  assert.equal(
    (await f.start("application/pdf", 20 * 1024 * 1024)).status,
    200,
  );
  assert.equal(
    (await f.start("application/pdf", 20 * 1024 * 1024 + 1)).status,
    400,
  );
  assert.equal((await f.start("video/mp4", 20 * 1024 * 1024)).status, 200);
  assert.equal((await f.start("video/mp4", 20 * 1024 * 1024 + 1)).status, 400);
  assert.equal((await f.start("text/html", 100)).status, 400);
  assert.equal((await f.start("application/pdf", 0)).status, 400);
});
test("chunked PDF survives cold calls and conflicts, remains private until completion and streams byte-perfect", async () => {
  const f = await fixture(),
    bytes = Buffer.alloc(3 * CHUNK + 37, 71);
  bytes.write("%PDF-1.7\n");
  const key = randomUUID(),
    transfer = await f.start("application/pdf", bytes.length, key),
    id = transfer.data.id;
  assert.equal(transfer.status, 200);
  assert.equal(
    (await f.start("application/pdf", bytes.length, key)).data.id,
    id,
  );
  f.stores.state.rejectWrites = 1;
  assert.equal((await f.part(id, 0, bytes.subarray(0, CHUNK))).status, 200);
  const storedParts = f.stores.files.records.size;
  assert.equal((await f.part(id, 0, bytes.subarray(0, CHUNK))).status, 200);
  assert.equal(f.stores.files.records.size, storedParts);
  assert.equal((await f.part(id, 0, Buffer.alloc(CHUNK, 1))).status, 409);
  assert.equal((await f.part(id, 1, Buffer.alloc(10))).status, 400);
  assert.equal((await f.finish(id)).status, 400);
  const chunkId = [...f.stores.files.records.keys()][0];
  assert.equal(
    (await f.call("file?id=" + chunkId, undefined, "visitor")).status,
    404,
  );
  const results = await Promise.all(
    [1, 2, 3].map((index) =>
      f.part(id, index, bytes.subarray(index * CHUNK, (index + 1) * CHUNK)),
    ),
  );
  assert(results.every((r) => r.status === 200));
  const complete = await f.finish(id);
  assert.equal(complete.status, 200);
  assert.equal((await f.finish(id)).data, complete.data);
  const downloaded = await f.call(complete.data, undefined, "visitor");
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "application/pdf");
  assert.equal(downloaded.headers.get("content-length"), String(bytes.length));
  assert.deepEqual(downloaded.data, bytes);
  const range = await f.call(complete.data, undefined, "visitor", {
    headers: { range: `bytes=${CHUNK - 4}-${CHUNK + 12}` },
  });
  assert.equal(range.status, 206);
  assert.deepEqual(range.data, bytes.subarray(CHUNK - 4, CHUNK + 13));
  assert.equal(
    (
      await f.call(complete.data, undefined, "visitor", {
        headers: { range: "bytes=999999999-" },
      })
    ).status,
    416,
  );
});
test("MP4/WebM use safe range playback; a renamed non-video never becomes public", async () => {
  const f = await fixture(),
    mp4 = Buffer.alloc(CHUNK * 2 + 29, 12);
  mp4.writeUInt32BE(24, 0);
  mp4.write("ftypisom", 4);
  const video = await f.upload("video/mp4", mp4);
  assert.equal(video.status, 200);
  const first = await f.call(video.data, undefined, "visitor");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("content-type"), "video/mp4");
  assert.deepEqual(first.data, mp4);
  assert.equal(first.headers.get("content-range"), null);
  const last = await f.call(video.data, undefined, "visitor", {
    headers: { range: `bytes=${2 * CHUNK}-` },
  });
  assert.deepEqual(last.data, mp4.subarray(2 * CHUNK));
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 1, 1]);
  const small = await f.upload("video/webm", webm);
  assert.equal(small.status, 200);
  assert.deepEqual((await f.call(small.data, undefined, "visitor")).data, webm);
  const invalid = await f.upload(
    "video/mp4",
    Buffer.from("<html>not a video</html>"),
  );
  assert.equal(invalid.status, 400);
});

test("a complete 20 MiB catalogue uploads and downloads with no four-MiB regression", async () => {
  const f = await fixture(),
    pdf = Buffer.alloc(20 * 1024 * 1024, 32);
  pdf.write("%PDF-1.7\n% TEST-ONLY catalogue boundary fixture\n");
  const uploaded = await f.upload("application/pdf", pdf);
  assert.equal(uploaded.status, 200);
  const downloaded = await f.call(uploaded.data, undefined, "visitor");
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-length"), String(pdf.length));
  assert.deepEqual(downloaded.data, pdf);
});

test("RUN.BAT storage keeps concurrent parts and duplicate finalization and streams through native HTTP", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-large-native-"),
  );
  const store = localStore.createLocalStore({ dataDir: directory });
  const server = http.createServer((req, res) => {
    void store.handle(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  const call = async (name, data, binary = false) => {
    const r = await fetch(base + "/api/local/" + name, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(data === undefined
          ? {}
          : {
              "content-type": binary
                ? "application/octet-stream"
                : "application/json",
            }),
      },
      body:
        data === undefined ? undefined : binary ? data : JSON.stringify(data),
    });
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return {
      status: r.status,
      data: r.headers.get("content-type")?.startsWith("application/json")
        ? await r.json()
        : Buffer.from(await r.arrayBuffer()),
    };
  };
  try {
    const status = await call("status");
    assert.equal(
      (
        await call("setup", {
          token: status.data.setup_token,
          password: "TEST-ONLY-native-file-password!",
        })
      ).status,
      200,
    );
    const pdf = Buffer.alloc(CHUNK * 2 + 37, 32);
    pdf.write("%PDF-1.7\n");
    const start = await call("upload-start", {
      mime: "application/pdf",
      size: pdf.length,
      key: randomUUID(),
    });
    const id = start.data.id;
    const parts = await Promise.all(
      [0, 1, 2].map((i) =>
        call(
          `upload-part?id=${id}&index=${i}`,
          pdf.subarray(i * CHUNK, (i + 1) * CHUNK),
          true,
        ),
      ),
    );
    assert(parts.every((r) => r.status === 200));
    const complete = await Promise.all([
      call("upload-finish", { id }),
      call("upload-finish", { id }),
    ]);
    assert(complete.every((r) => r.status === 200));
    assert.equal(complete[0].data, complete[1].data);
    assert.deepEqual(
      (await call(complete[0].data.replace("/api/local/", ""))).data,
      pdf,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    if (
      path.dirname(directory) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith("uniplast-large-native-")
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});
