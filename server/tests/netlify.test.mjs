import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";

const SITE = "https://uniplast-test.example";
const INSTALL_KEY = "TEST-ONLY-installation-key-never-use-in-production";
const PASSWORD = "TEST-ONLY-admin-password-2026!";

function fixture(options = {}) {
  const stores = memoryStores(),
    cookies = {};
  const config = {
    getStores: () => stores,
    origins: [SITE],
    setupKey: INSTALL_KEY,
    ...options,
  };
  async function call(name, data, who = "admin", extra = {}) {
    const route = name.startsWith("/") ? name : "/api/local/" + name;
    // Construct a new handler on every call: no warm process may own the data.
    const request = new Request(SITE + route, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined ? {} : { "content-type": "application/json" }),
        ...(cookies[who] ? { cookie: cookies[who] } : {}),
        ...extra.headers,
      },
      body:
        data === undefined
          ? undefined
          : extra.binary
            ? data
            : JSON.stringify(data),
    });
    const response = await createNetlifyHandler(config)(request, {
      ip: extra.ip || "192.0.2.1",
      requestId: "test",
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) cookies[who] = cookie.split(";")[0];
    return {
      status: response.status,
      headers: response.headers,
      data: response.headers.get("content-type")?.startsWith("application/json")
        ? await response.json()
        : await response.text(),
    };
  }
  async function setup() {
    assert.equal(
      (await call("setup", { setup_key: INSTALL_KEY, password: PASSWORD }))
        .status,
      200,
    );
  }
  return { stores, cookies, config, call, setup };
}

test("Netlify: durable snapshots, private access and concurrent orders", async (t) => {
  const f = fixture();
  let catalog, product, customerCode, orderPayload;
  await t.test(
    "public status cannot reveal a setup secret or claim management",
    async () => {
      const first = await f.call("status", undefined, "visitor");
      assert.equal(first.data.setup_key_required, true);
      assert.equal(first.data.setup_token, undefined);
      assert.equal(JSON.stringify(first.data).includes(INSTALL_KEY), false);
      assert.equal(
        (
          await f.call(
            "setup",
            { token: first.data.setup_token, password: PASSWORD },
            "visitor",
          )
        ).status,
        403,
      );
      const disabled = fixture({ setupKey: undefined });
      assert.equal((await disabled.call("status")).data.setup_available, false);
      assert.equal(
        (await disabled.call("setup", { password: PASSWORD })).status,
        403,
      );
      await f.setup();
      assert.match(f.cookies.admin, /^__Host-uniplast_session=/);
      const status = await f.call("status");
      assert.equal(status.data.admin, true);
      const login = await f.call("admin-login", { password: PASSWORD });
      assert.match(login.headers.get("set-cookie"), /HttpOnly/);
      assert.match(login.headers.get("set-cookie"), /Secure/);
      assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    },
  );
  await t.test(
    "cold invocations preserve 350 products; a visitor receives no private prices",
    async () => {
      catalog = (await f.call("catalog")).data;
      assert.equal(catalog.products.length, 350);
      assert.equal(catalog.families.length, 17);
      assert.equal(
        catalog.products.filter((p) => p.price_on_request).length,
        34,
      );
      const writes = f.stores.state.writes;
      const publicCatalog = (await f.call("catalog", undefined, "visitor"))
        .data;
      assert.ok(
        publicCatalog.products.every(
          (p) => p.unit_price_cents === 0 && !p.source_metadata,
        ),
      );
      assert.equal(
        f.stores.state.writes,
        writes,
        "reads must not write a snapshot",
      );
      product = {
        ...catalog.products.find((p) => !p.price_on_request),
        available: true,
        availability_confirmed: true,
        unit_price_cents: 1000,
        discount_price_cents: null,
        stock_cartons: 3,
        pack_size: 10,
      };
      assert.equal((await f.call("product-save", product)).status, 200);
    },
  );
  await t.test(
    "phone and six digits restore a session on another cold invocation",
    async () => {
      customerCode = (
        await f.call("codes-save", {
          name: "Client test",
          phone: "0550000000",
          pin: "012345",
          enabled: true,
        })
      ).data;
      assert.equal(
        (
          await f.call(
            "client-login",
            { phone: "0550000000", pin: "012345" },
            "client",
          )
        ).status,
        200,
      );
      assert.equal(
        (await f.call("status", undefined, "client")).data.session.personal,
        true,
      );
      assert.equal(
        (await f.call("catalog", undefined, "client")).data.products.find(
          (p) => p.id === product.id,
        ).unit_price_cents,
        1000,
      );
      const rows = (await f.call("codes-list", {})).data;
      assert.equal(rows[0].hash, undefined);
      assert.equal(rows[0].pin, undefined);
    },
  );
  await t.test(
    "simultaneous checkouts never oversell or lose successful orders",
    async () => {
      orderPayload = {
        cart: [{ product_id: product.id, cartons: 1 }],
        customer: {
          name: "Client test",
          phone: "0550000000",
          wilaya: "Oran",
          address: "Adresse de test 123",
          notes: "",
        },
        expected: [
          { product_id: product.id, unit_price_cents: 1000, pack_size: 10 },
        ],
        currency: "DZD",
        shipping: 0,
      };
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          f.call(
            "order-create",
            { ...orderPayload, key: randomUUID() },
            "client",
          ),
        ),
      );
      assert.equal(
        results.filter((r) => r.status === 200).length,
        3,
        JSON.stringify(results),
      );
      assert.equal(results.filter((r) => r.status === 400).length, 3);
      assert.equal((await f.call("orders-list", {}, "client")).data.length, 3);
      assert.equal(
        (await f.call("catalog")).data.products.find((p) => p.id === product.id)
          .stock_cartons,
        0,
      );
      assert.ok(f.stores.state.conflicts > 0);
      assert.deepEqual((await f.call("orders-list", {}, "visitor")).data, []);
    },
  );
  await t.test(
    "retries with the same checkout key reserve stock once",
    async () => {
      await f.call("product-save", { ...product, stock_cartons: 2 });
      const payload = { ...orderPayload, key: randomUUID() };
      const results = await Promise.all([
        f.call("order-create", payload, "client"),
        f.call("order-create", payload, "client"),
      ]);
      assert.ok(results.every((r) => r.status === 200));
      assert.equal(results[0].data.id, results[1].data.id);
      assert.equal(
        (await f.call("catalog")).data.products.find((p) => p.id === product.id)
          .stock_cartons,
        1,
      );
    },
  );
  await t.test(
    "uploaded PDFs remain durable and private after all temporary folders vanish",
    async () => {
      const upload = await f.call(
        "upload?public=0",
        "%PDF-1.4\nTest privé",
        "client",
        { binary: true, headers: { "content-type": "application/pdf" } },
      );
      assert.equal(upload.status, 200);
      assert.equal(
        (await f.call(upload.data, undefined, "visitor")).status,
        404,
      );
      assert.match(
        (await f.call(upload.data, undefined, "client")).data,
        /Test privé/,
      );
      const pub = await f.call(
        "upload?public=1",
        "%PDF-1.4\nCatalogue test",
        "admin",
        { binary: true, headers: { "content-type": "application/pdf" } },
      );
      assert.equal((await f.call(pub.data, undefined, "visitor")).status, 200);
      assert.equal(f.stores.files.records.size, 2);
      assert.equal(
        (
          await f.call("upload?public=1", "<html>bad</html>", "admin", {
            binary: true,
            headers: { "content-type": "application/pdf" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await f.call(
            "upload?public=1",
            new Uint8Array(4 * 1024 * 1024 + 1),
            "admin",
            { binary: true, headers: { "content-type": "application/pdf" } },
          )
        ).status,
        413,
      );
    },
  );
  await t.test(
    "a definite upload conflict removes only its orphan and retries durably",
    async () => {
      f.stores.state.rejectWrites = 1;
      const count = f.stores.files.records.size;
      const result = await f.call(
        "upload?public=1",
        "%PDF-1.4\nRetry test",
        "admin",
        { binary: true, headers: { "content-type": "application/pdf" } },
      );
      assert.equal(result.status, 200);
      assert.equal(f.stores.files.records.size, count + 1);
      assert.equal(
        (await f.call(result.data, undefined, "visitor")).status,
        200,
      );
    },
  );
  await t.test(
    "settings, family slides and suggestions survive cold invocations",
    async () => {
      assert.equal(
        (
          await f.call("settings-save", {
            ...catalog.settings,
            about_body: "Présentation de test persistante.",
            home_slider_height: 620,
          })
        ).status,
        200,
      );
      const family = { ...catalog.families[0], slider_height: 420 };
      assert.equal((await f.call("family-save", family)).status, 200);
      assert.equal(
        (
          await f.call(
            "feedback-create",
            {
              name: "Visiteur test",
              message: "Une proposition de test persistante.",
            },
            "visitor",
          )
        ).status,
        200,
      );
      const after = (await f.call("catalog")).data;
      assert.equal(after.settings.home_slider_height, 620);
      assert.equal(
        after.families.find((v) => v.id === family.id).slider_height,
        420,
      );
      assert.equal((await f.call("feedback-list", {})).data.length, 1);
    },
  );
  await t.test(
    "failed login counters persist even when the HTTP result is an error",
    async () => {
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await f.call(
              "client-login",
              { phone: "0550000000", pin: "000000" },
              "attacker",
              { ip: "192.0.2.99" },
            )
          ).status,
          401,
        );
      assert.equal(
        (
          await f.call(
            "client-login",
            { phone: "0550000000", pin: "012345" },
            "attacker",
            { ip: "192.0.2.99" },
          )
        ).status,
        429,
      );
    },
  );
  await t.test(
    "PIN rotation and logout invalidate durable sessions",
    async () => {
      const rows = (await f.call("codes-list", {})).data;
      const oldCookie = f.cookies.client;
      await f.call("codes-save", {
        id: rows[0].user_id,
        name: "Client test",
        phone: "0550000000",
        pin: "654321",
        enabled: true,
      });
      assert.equal(
        (await f.call("status", undefined, "client")).data.session.personal,
        false,
      );
      f.cookies.client = oldCookie;
      assert.ok(
        (await f.call("catalog", undefined, "client")).data.products.every(
          (p) => p.price_hidden,
        ),
      );
      const logout = await f.call("logout", {});
      assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
      assert.equal((await f.call("codes-list", {})).status, 403);
    },
  );
});

test("Netlify rejects untrusted hosts, cross-origin calls and unavailable persistence", async () => {
  const f = fixture();
  const handler = createNetlifyHandler(f.config);
  assert.equal(
    (await handler(new Request("https://evil.example/api/local/catalog")))
      .status,
    403,
  );
  assert.equal(
    (
      await f.call("catalog", undefined, "visitor", {
        headers: { origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("catalog", undefined, "visitor", {
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status,
    403,
  );
  f.stores.state.unavailable = true;
  const unavailable = await f.call("status");
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("set-cookie"), null);
  f.stores.state.unavailable = false;
  f.stores.state.rejectWrites = 20;
  const conflict = await createNetlifyHandler({ ...f.config, maxAttempts: 2 })(
    new Request(SITE + "/api/local/status"),
  );
  assert.equal(conflict.status, 503);
  assert.equal(conflict.headers.get("set-cookie"), null);
});
