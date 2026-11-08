import { test } from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
import { verifyProductVisibility } from "./product-visibility-scenario.cjs";

test("Netlify: visibility persists through cold calls and CAS retries while photos remain intact", async () => {
  const site = "https://product-visibility-test.example";
  const setupKey = "TEST-ONLY-visibility-setup-key-2026";
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
      { ip: "192.0.2.89" },
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
        password: "TEST-ONLY-netlify-visibility-password!",
      })
    ).status,
    200,
  );
  await verifyProductVisibility({
    call,
    restart: async () => {},
    beforeHide: () => {
      stores.state.rejectWrites = 1;
    },
  });
  assert(stores.state.conflicts >= 1);
  assert.equal(stores.files.records.size, 1);
});
