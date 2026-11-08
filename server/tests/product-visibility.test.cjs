const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createLocalStore } = require("../local-store.cjs");
const {
  verifyProductVisibility,
} = require("./product-visibility-scenario.cjs");

test("local: hidden products stay private across restart and cannot be ordered or reserved using stale IDs", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-visibility-test-"),
  );
  let store = createLocalStore({ dataDir: directory });
  const cookies = {};
  const server = http.createServer((req, res) => void store.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const site = "http://127.0.0.1:" + server.address().port;
  const call = async (name, data, who = "admin", extra = {}) => {
    const response = await fetch(
      site + (name.startsWith("/") ? name : "/api/local/" + name),
      {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined
            ? {}
            : {
                "content-type": extra.binary ? "image/png" : "application/json",
              }),
          ...(cookies[who] ? { cookie: cookies[who] } : {}),
        },
        body:
          data === undefined
            ? undefined
            : extra.binary
              ? data
              : JSON.stringify(data),
      },
    );
    if (response.headers.has("set-cookie"))
      cookies[who] = response.headers.get("set-cookie").split(";")[0];
    return {
      status: response.status,
      data: response.headers.get("content-type")?.startsWith("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    };
  };
  try {
    const status = await call("status");
    assert.equal(
      (
        await call("setup", {
          token: status.data.setup_token,
          password: "TEST-ONLY-local-visibility-password!",
        })
      ).status,
      200,
    );
    await verifyProductVisibility({
      call,
      restart: async () => {
        store.close();
        store = createLocalStore({ dataDir: directory });
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir()),
    );
    assert(path.basename(directory).startsWith("uniplast-visibility-test-"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
