import { test } from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
import { verifyProductImages } from "./product-images-scenario.cjs";

test("Netlify: photo-only edits survive cold calls and merge a concurrent price change after CAS conflict", async () => {
  const site = "https://product-images-test.example";
  const setupKey = "TEST-ONLY-product-images-setup-key";
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
                "content-type": extra.binary
                  ? extra.type || "image/png"
                  : "application/json",
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
  await verifyProductImages({
    call,
    site,
    restart: async () => {},
    beforeSave: (current) => {
      const expected = {
        ...current,
        unit_price_cents: 5432,
        description: "TEST concurrent owner edit",
      };
      const realSet = stores.state.set.bind(stores.state);
      let armed = true;
      stores.state.set = async (...args) => {
        if (armed) {
          armed = false;
          assert.equal((await call("product-save", expected)).status, 200);
        }
        return realSet(...args);
      };
      return expected;
    },
  });
  assert(stores.state.conflicts >= 1);
  assert.equal(stores.files.records.size, 3);
});
