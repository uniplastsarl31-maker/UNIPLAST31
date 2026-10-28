const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createLocalStore, phoneOf } = require("../local-store.cjs");
test("local store: real persistence, private prices, PIN access and immutable orders", async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-store-qa-"),
  );
  let store = createLocalStore({ dataDir: directory });
  const server = http.createServer((req, res) => {
    void store.handle(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const jar = {};
  async function call(name, p, who = "admin", extra = {}) {
    const r = await fetch(base + "/api/local/" + name, {
      method: p === undefined ? "GET" : "POST",
      headers: {
        ...(p === undefined ? {} : { "content-type": "application/json" }),
        ...(jar[who] ? { cookie: jar[who] } : {}),
        ...extra,
      },
      body: p === undefined ? undefined : JSON.stringify(p),
    });
    const cookie = r.headers.get("set-cookie");
    if (cookie) jar[who] = cookie.split(";")[0];
    return { status: r.status, data: await r.json() };
  }
  try {
    let status = await call("status");
    assert.equal(status.data.setup_required, true);
    const token = status.data.setup_token;
    await t.test(
      "setup uses a chosen strong admin password; cross-origin and anonymous writes refused",
      async () => {
        assert.equal(
          (await call("setup", { token, password: "123456" })).status,
          400,
        );
        assert.equal(
          (
            await call(
              "setup",
              { token, password: "Local-QA-Password-2026!" },
              "admin",
              { origin: "https://other.example" },
            )
          ).status,
          403,
        );
        assert.equal(
          (await call("setup", { token, password: "Local-QA-Password-2026!" }))
            .status,
          200,
        );
        assert.equal(
          (await call("setup", { token, password: "Other-QA-Password-2026!" }))
            .status,
          403,
        );
        assert.equal((await call("codes-list", {}, "visitor")).status, 403);
      },
    );
    let catalog = (await call("catalog")).data,
      product = {
        ...catalog.products.find((p) => !p.price_on_request),
        available: true,
        availability_confirmed: true,
        stock_cartons: 10,
        discount_price_cents: 500,
        unit_price_cents: 1000,
        discount_start: new Date(Date.now() - 60000).toISOString(),
        discount_end: new Date(Date.now() + 3600000).toISOString(),
        show_offer: true,
        pack_size: 10,
      };
    await t.test(
      "350 references and 17 families seeded, prices never sent to visitors",
      async () => {
        assert.equal(catalog.products.length, 350);
        assert.equal(catalog.families.length, 17);
        assert.equal(
          catalog.products.filter((p) => p.price_on_request).length,
          34,
        );
        assert.equal((await call("product-save", product)).status, 200);
        const hidden = (
          await call("catalog", undefined, "visitor")
        ).data.products.find((p) => p.id === product.id);
        assert.equal(hidden.price_hidden, true);
        assert.equal(hidden.unit_price_cents, 0);
        assert.equal(hidden.discount_price_cents, null);
        assert.equal(hidden.source_metadata, undefined);
        assert.equal(hidden.public_discount_percent, 50);
      },
    );
    let codeId, clientCookie;
    await t.test(
      "six digits including leading zero, normalized phone and hash-only storage",
      async () => {
        assert.equal(phoneOf("٠٥٥٠ ٠٠ ٠٠ ٠٠"), "+213550000000");
        assert.equal(
          (
            await call("codes-save", {
              name: "Client test",
              phone: "0550000000",
              pin: "12345",
              enabled: true,
            })
          ).status,
          400,
        );
        const created = await call("codes-save", {
          name: "Client test",
          phone: "0550000000",
          pin: "012345",
          enabled: true,
        });
        assert.equal(created.status, 200);
        codeId = created.data.id;
        assert.equal(
          (
            await call(
              "client-login",
              { phone: "0550000000", pin: "012345" },
              "client",
            )
          ).status,
          200,
        );
        clientCookie = jar.client;
        assert.equal(
          (await call("catalog", undefined, "client")).data.products.find(
            (p) => p.id === product.id,
          ).unit_price_cents,
          1000,
        );
        const rows = (await call("codes-list", {})).data;
        assert.equal(rows[0].phone, "+213550000000");
        assert(!JSON.stringify(rows).includes("012345"));
        assert(!JSON.stringify(rows).includes("hash"));
        const bytes = fs.readFileSync(path.join(directory, "store.sqlite-wal"));
        assert(!bytes.includes(Buffer.from("012345")));
      },
    );
    let order;
    const cart = [{ product_id: product.id, cartons: 2 }],
      customer = {
        name: "Client test",
        phone: "0550000000",
        wilaya: "Oran",
        address: "Adresse de test 123",
        notes: "",
      };
    const payload = {
      cart,
      customer,
      key: crypto.randomUUID(),
      expected: [
        { product_id: product.id, unit_price_cents: 500, pack_size: 10 },
      ],
      currency: "DZD",
      shipping: 0,
    };
    await t.test(
      "atomic stock, idempotency, current pricing and frozen invoice snapshot",
      async () => {
        assert.equal(
          (
            await call(
              "order-create",
              {
                ...payload,
                expected: [{ ...payload.expected[0], unit_price_cents: 1 }],
              },
              "client",
            )
          ).status,
          400,
        );
        order = (await call("order-create", payload, "client")).data;
        assert.equal(order.total_cents, 10000);
        assert.equal(order.items[0].unit_price_cents, 500);
        assert.equal(order.company_snapshot.company_name, "UNIPLAST");
        const replay = (await call("order-create", payload, "client")).data;
        assert.equal(replay.id, order.id);
        assert.equal(
          (await call("catalog")).data.products.find((p) => p.id === product.id)
            .stock_cartons,
          8,
        );
        assert.equal((await call("orders-list", {}, "visitor")).data.length, 0);
        await call("product-save", {
          ...product,
          stock_cartons: 8,
          unit_price_cents: 3000,
          discount_price_cents: 2000,
        });
        assert.equal(
          (await call("orders-list", {}, "client")).data[0].items[0]
            .unit_price_cents,
          500,
        );
      },
    );
    await t.test(
      "settings, sliders, suggestions and attachments persist and remain private",
      async () => {
        const s = {
          ...catalog.settings,
          home_slider_height: 620,
          about_title: "Notre entreprise",
          about_body: "Présentation de test de notre entreprise.",
        };
        assert.equal((await call("settings-save", s)).status, 200);
        const family = {
          ...catalog.families[0],
          slides: [
            {
              id: crypto.randomUUID(),
              title: "Collection test",
              body: "Une collection.",
              eyebrow: "UNIPLAST",
              image: "/assets/basket.webp",
              visible: true,
              family_id: catalog.families[0].id,
              cta: "Découvrir",
              scale: 1.25,
            },
          ],
          slider_height: 420,
        };
        assert.equal((await call("family-save", family)).status, 200);
        assert.equal(
          (
            await call(
              "feedback-create",
              {
                name: "Visiteur",
                phone: "",
                message: "Je propose une nouvelle contenance.",
              },
              "visitor",
            )
          ).status,
          200,
        );
        assert.equal((await call("feedback-list", {}, "visitor")).status, 403);
        assert.equal((await call("feedback-list", {})).data.length, 1);
        const r = await fetch(base + "/api/local/upload?public=0", {
          method: "POST",
          headers: { "content-type": "application/pdf", cookie: jar.client },
          body: "%PDF-1.4\nQA private",
        });
        const link = await r.json();
        assert.equal(r.status, 200);
        assert.equal((await fetch(base + link)).status, 404);
        assert.equal(
          (await fetch(base + link, { headers: { cookie: jar.client } }))
            .status,
          200,
        );
        store.close();
        store = createLocalStore({ dataDir: directory });
        assert.equal((await call("status")).data.admin, true);
        assert.equal(
          (await call("catalog")).data.settings.home_slider_height,
          620,
        );
        assert.equal(
          (await call("catalog")).data.families.find((f) => f.id === family.id)
            .slides[0].scale,
          1.25,
        );
        assert.equal((await call("feedback-list", {})).data.length, 1);
      },
    );
    await t.test(
      "guest custom requests need no account/address and closed preorders are rejected",
      async () => {
        await call("status", undefined, "guest");
        const request = {
          kind: "custom",
          product_id: null,
          cartons: 0,
          customer: {
            name: "Visiteur test",
            phone: "0660000000",
            address: "",
            wilaya: "",
            notes: "",
          },
          details: {
            description: "Un contenant rectangulaire sur mesure.",
            quantity: "500 pièces",
            dimensions: "",
            capacity: "",
            material: "",
            color: "",
            attachments: [],
          },
        };
        const key = crypto.randomUUID(),
          first = await call("request-create", { request, key }, "guest");
        assert.equal(first.status, 200);
        assert.equal(first.data.cartons, 0);
        assert.equal(
          (await call("request-create", { request, key }, "guest")).data.id,
          first.data.id,
        );
        assert.equal(
          (
            await call(
              "request-create",
              {
                request: {
                  ...request,
                  kind: "preorder",
                  product_id: product.id,
                  cartons: 1,
                  customer,
                },
                key: crypto.randomUUID(),
              },
              "guest",
            )
          ).status,
          400,
        );
        assert.equal((await call("requests-list", {})).data.length, 1);
      },
    );
    await t.test(
      "PIN rotation and disabling invalidate previous sessions, history returns on a different device",
      async () => {
        assert.equal(
          (
            await call("codes-save", {
              id: codeId,
              name: "Client test",
              phone: "0550000000",
              pin: "654321",
              enabled: true,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call("catalog", undefined, "client")).data.products[0]
            .price_hidden,
          true,
        );
        assert.equal((await call("orders-list", {}, "client")).data.length, 0);
        assert.equal(
          (
            await call(
              "client-login",
              { phone: "0550000000", pin: "012345" },
              "client",
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await call(
              "client-login",
              { phone: "+213550000000", pin: "654321" },
              "newDevice",
            )
          ).status,
          200,
        );
        assert.equal(
          (await call("orders-list", {}, "newDevice")).data[0].id,
          order.id,
        );
        await call("codes-save", {
          id: codeId,
          name: "Client test",
          phone: "0550000000",
          pin: "",
          enabled: false,
        });
        assert.equal(
          (await call("orders-list", {}, "newDevice")).data.length,
          0,
        );
        assert.equal(
          (
            await call(
              "client-login",
              { phone: "0550000000", pin: "654321" },
              "newDevice",
            )
          ).status,
          401,
        );
      },
    );
    await t.test(
      "cancel restores stock once and cancelled status is final",
      async () => {
        assert.equal(
          (await call("order-status", { id: order.id, status: "cancelled" }))
            .status,
          200,
        );
        assert.equal(
          (await call("order-status", { id: order.id, status: "cancelled" }))
            .status,
          200,
        );
        assert.equal(
          (await call("catalog")).data.products.find((p) => p.id === product.id)
            .stock_cartons,
          10,
        );
        assert.equal(
          (await call("order-status", { id: order.id, status: "confirmed" }))
            .status,
          400,
        );
      },
    );
    await t.test(
      "admin password change invalidates old admin sessions and persists",
      async () => {
        await call(
          "admin-login",
          { password: "Local-QA-Password-2026!" },
          "admin2",
        );
        assert.equal(
          (
            await call("admin-password", {
              current: "Local-QA-Password-2026!",
              password: "Changed-QA-Password-2026!",
            })
          ).status,
          200,
        );
        assert.equal((await call("codes-list", {}, "admin2")).status, 403);
        assert.equal(
          (
            await call(
              "admin-login",
              { password: "Local-QA-Password-2026!" },
              "admin2",
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await call(
              "admin-login",
              { password: "Changed-QA-Password-2026!" },
              "admin2",
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "six failed attempts lock login; counters survive restart",
      async () => {
        for (let i = 0; i < 6; i++)
          await call(
            "client-login",
            { phone: "0660000000", pin: "999999" },
            "attacker",
          );
        store.close();
        store = createLocalStore({ dataDir: directory });
        assert.equal(
          (
            await call(
              "client-login",
              { phone: "0660000000", pin: "999999" },
              "attacker",
            )
          ).status,
          429,
        );
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    const absolute = fs.realpathSync(directory);
    assert(
      absolute.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) &&
        path.basename(absolute).startsWith("uniplast-store-qa-"),
    );
    fs.rmSync(absolute, { recursive: true, force: true });
  }
});
