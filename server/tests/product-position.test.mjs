import { test } from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
import { verifyProductPosition } from "./product-position-scenario.cjs";

test("Netlify: manual positions are durable across cold requests and CAS retries without modifying photos", async () => {
  const site = "https://product-position-test.example";
  const setupKey = "TEST-ONLY-product-position-setup-key";
  const stores = memoryStores(),
    cookies = {};
  const call = async (name, data, who = "admin", extra = {}) => {
    const response = await createNetlifyHandler({
      getStores: () => stores,
      origins: [site],
      setupKey,
    })(
      new Request(site + (name.startsWith("/") ? name : "/api/local/" + name), {
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
      }),
      { ip: "192.0.2.88" },
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
  assert.equal(
    (
      await call("setup", {
        setup_key: setupKey,
        password: "TEST-ONLY-netlify-position-password!",
      })
    ).status,
    200,
  );
  await verifyProductPosition({
    call,
    restart: async () => {},
    beforeMove: () => {
      stores.state.rejectWrites = 1;
    },
  });
  assert(stores.state.conflicts >= 1);
  assert.equal(stores.files.records.size, 1);
});
