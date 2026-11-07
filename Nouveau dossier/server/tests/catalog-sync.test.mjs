import { test } from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
const SITE = "https://catalog-sync-test.example";
const INSTALL = "TEST-ONLY-catalog-sync-installation-key";
async function fixture() {
  const stores = memoryStores(),
    cookies = {};
  const config = {
    origins: [SITE],
    setupKey: INSTALL,
    getStores: () => stores,
  };
  const call = async (name, data, who = "admin", extra = {}) => {
    const response = await createNetlifyHandler(config)(
      new Request(SITE + (name.startsWith("/") ? name : "/api/local/" + name), {
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
      { ip: "192.0.2.31" },
    );
    if (response.headers.has("set-cookie"))
      cookies[who] = response.headers.get("set-cookie").split(";")[0];
    return {
      status: response.status,
      headers: response.headers,
      data: response.headers.get("content-type")?.startsWith("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    };
  };
  assert.equal(
    (
      await call("setup", {
        setup_key: INSTALL,
        password: "TEST-ONLY-catalog-sync-password!",
      })
    ).status,
    200,
  );
  return { call, stores };
}
test("conditional catalogue returns tiny unchanged views; private price updates do not leak to guests and image cache stays fast", async () => {
  const f = await fixture(),
    before = (await f.call("catalog")).data;
  assert(Array.isArray(before.products));
  assert.equal(before.revision, undefined);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const upload = await f.call("upload?public=1", png, "admin", {
    binary: true,
  });
  assert.equal(upload.status, 200);
  const original = {
    ...before.products.find((p) => !p.price_on_request),
    images: [{ url: upload.data, scale: 1, x: 0, y: 0 }],
    discount_price_cents: null,
    discount_start: null,
    discount_end: null,
  };
  assert.equal((await f.call("product-save", original)).status, 200);
  const guest = await f.call("catalog?sync=1", undefined, "visitor");
  assert.equal(guest.data.unchanged, false);
  assert.equal(guest.data.admin, false);
  assert.equal(guest.data.client_approved, false);
  assert.match(guest.data.revision, /^[0-9a-f]{64}$/);
  assert(
    guest.data.catalog.products.every(
      (p) =>
        p.price_hidden &&
        p.unit_price_cents === 0 &&
        p.source_metadata === undefined,
    ),
  );
  for (const header of [
    "cache-control",
    "cdn-cache-control",
    "netlify-cdn-cache-control",
  ])
    assert.equal(guest.headers.get(header), "no-store");
  assert.equal(guest.headers.get("vary"), "Cookie");
  const repeated = await f.call(
    "catalog?sync=1&revision=" + guest.data.revision,
    undefined,
    "visitor",
  );
  assert.equal(repeated.data.unchanged, true);
  assert.equal(repeated.data.catalog, undefined);
  assert(JSON.stringify(repeated.data).length < 250);
  const admin = (await f.call("catalog?sync=1")).data;
  const updated = {
    ...original,
    unit_price_cents: original.unit_price_cents + 12345,
  };
  assert.equal((await f.call("product-save", updated)).status, 200);
  const hiddenChange = (
    await f.call(
      "catalog?sync=1&revision=" + guest.data.revision,
      undefined,
      "visitor",
    )
  ).data;
  assert.equal(hiddenChange.unchanged, true);
  const visibleChange = (
    await f.call("catalog?sync=1&revision=" + admin.revision)
  ).data;
  assert.equal(visibleChange.unchanged, false);
  assert.equal(visibleChange.admin, true);
  assert.equal(
    visibleChange.catalog.products.find((p) => p.id === original.id)
      .unit_price_cents,
    updated.unit_price_cents,
  );
  assert.equal(
    visibleChange.catalog.products.find((p) => p.id === original.id).images[0]
      .url,
    upload.data,
  );
  const image = await f.call(upload.data, undefined, "visitor");
  assert.equal(image.status, 200);
  assert.deepEqual(image.data, png);
  assert.equal(image.headers.get("cache-control"), "public, max-age=3600");
});
test("phone access revocation and settings visibility invalidate the caller view without carrying stale private prices", async () => {
  const f = await fixture(),
    c = (await f.call("catalog")).data;
  const customer = {
    name: "TEST ONLY",
    phone: "0770123456",
    pin: "006789",
    enabled: true,
  };
  const created = await f.call("codes-save", customer);
  assert.equal(created.status, 200);
  assert.equal(
    (
      await f.call(
        "client-login",
        { phone: customer.phone, pin: customer.pin },
        "client",
      )
    ).status,
    200,
  );
  const approved = (await f.call("catalog?sync=1", undefined, "client")).data;
  assert.equal(approved.client_approved, true);
  assert.equal(approved.admin, false);
  assert(
    approved.catalog.products.some(
      (p) => !p.price_hidden && p.unit_price_cents > 0,
    ),
  );
  assert.equal(
    (
      await f.call("codes-save", {
        ...customer,
        id: created.data.id,
        pin: "",
        enabled: false,
      })
    ).status,
    200,
  );
  const revoked = (
    await f.call(
      "catalog?sync=1&revision=" + approved.revision,
      undefined,
      "client",
    )
  ).data;
  assert.equal(revoked.unchanged, false);
  assert.equal(revoked.client_approved, false);
  assert(
    revoked.catalog.products.every(
      (p) => p.price_hidden && p.unit_price_cents === 0,
    ),
  );
  assert.equal(
    (
      await f.call("settings-save", {
        ...c.settings,
        price_visibility: "public",
      })
    ).status,
    200,
  );
  const publicView = (
    await f.call(
      "catalog?sync=1&revision=" + revoked.revision,
      undefined,
      "client",
    )
  ).data;
  assert.equal(publicView.unchanged, false);
  assert.equal(publicView.client_approved, false);
  assert(
    publicView.catalog.products.some(
      (p) => !p.price_hidden && p.unit_price_cents > 0,
    ),
  );
  assert.equal(
    (
      await f.call("codes-save", {
        ...customer,
        id: created.data.id,
        pin: "",
        enabled: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call(
        "client-login",
        { phone: customer.phone, pin: customer.pin },
        "client",
      )
    ).status,
    200,
  );
  const approvedPublic = (await f.call("catalog?sync=1", undefined, "client"))
    .data;
  assert.equal(approvedPublic.client_approved, true);
  assert.equal(
    (
      await f.call("codes-save", {
        ...customer,
        id: created.data.id,
        pin: "",
        enabled: false,
      })
    ).status,
    200,
  );
  const revokedPublic = (
    await f.call(
      "catalog?sync=1&revision=" + approvedPublic.revision,
      undefined,
      "client",
    )
  ).data;
  assert.equal(revokedPublic.unchanged, false);
  assert.equal(revokedPublic.client_approved, false);
  assert.deepEqual(revokedPublic.catalog, approvedPublic.catalog);
  assert.notEqual(revokedPublic.revision, approvedPublic.revision);
  const manager = (await f.call("catalog?sync=1")).data;
  assert.equal(manager.admin, true);
  assert.equal((await f.call("logout", {})).status, 200);
  const expiredManager = (
    await f.call("catalog?sync=1&revision=" + manager.revision)
  ).data;
  assert.equal(expiredManager.unchanged, false);
  assert.equal(expiredManager.admin, false);
});
