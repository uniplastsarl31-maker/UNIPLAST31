const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

async function verifyProductVisibility({
  call,
  restart,
  beforeHide = () => {},
}) {
  const catalog = (await call("catalog")).data;
  const source = catalog.products.find((p) => !p.price_on_request);
  assert.notEqual(source.visible, false, "legacy products remain visible");
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const upload = await call("upload?public=1", png, "admin", { binary: true });
  assert.equal(upload.status, 200);
  const original = {
    ...source,
    available: true,
    availability_confirmed: true,
    stock_cartons: 10,
    unit_price_cents: 1000,
    discount_price_cents: null,
    discount_start: null,
    discount_end: null,
    pack_size: 10,
    upcoming: false,
    images: [{ url: upload.data, scale: 1.7, x: 19, y: -12 }],
  };
  assert.equal((await call("product-save", original)).status, 200);
  assert.equal(
    (
      await call("codes-save", {
        name: "TEST client",
        phone: "0550000000",
        pin: "012345",
        enabled: true,
      })
    ).status,
    200,
  );
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
  await call("status", undefined, "guest");
  const customer = {
    name: "TEST client",
    phone: "0550000000",
    wilaya: "Oran",
    address: "TEST adresse 123",
    notes: "",
  };
  const payload = {
    cart: [{ product_id: original.id, cartons: 1 }],
    customer,
    expected: [
      { product_id: original.id, unit_price_cents: 1000, pack_size: 10 },
    ],
    currency: catalog.settings.currency,
    shipping: catalog.settings.shipping_cents,
  };
  const order = await call(
    "order-create",
    { ...payload, key: randomUUID() },
    "client",
  );
  assert.equal(order.status, 200);
  assert.equal(
    (await call("order-status", { id: order.data.id, status: "confirmed" }))
      .status,
    200,
  );
  const before = (await call("catalog")).data.products.find(
    (p) => p.id === original.id,
  );
  const guestBefore = (await call("catalog?sync=1", undefined, "guest")).data;
  const clientBefore = (await call("catalog?sync=1", undefined, "client")).data;
  assert(guestBefore.catalog.products.some((p) => p.id === original.id));
  assert(
    clientBefore.catalog.products.some(
      (p) => p.id === original.id && p.unit_price_cents === 1000,
    ),
  );
  assert.equal(guestBefore.catalog.sales[original.id], 1);

  beforeHide();
  assert.equal(
    (await call("product-save", { ...before, visible: false })).status,
    200,
  );
  const hidden = (await call("catalog")).data.products.find(
    (p) => p.id === original.id,
  );
  assert.deepEqual(hidden, { ...before, visible: false });
  assert.equal(
    (await call("product-save", { ...hidden, visible: true }, "guest")).status,
    403,
  );
  for (const [who, previous] of [
    ["guest", guestBefore],
    ["client", clientBefore],
  ]) {
    const after = (
      await call("catalog?sync=1&revision=" + previous.revision, undefined, who)
    ).data;
    assert.equal(after.unchanged, false);
    assert(!after.catalog.products.some((p) => p.id === original.id));
    assert.equal(
      after.catalog.sales[original.id],
      undefined,
      "hidden IDs must not leak through sales rankings",
    );
    const lookup = (
      await call("catalog?product_id=" + original.id, undefined, who)
    ).data;
    assert(!lookup.products.some((p) => p.id === original.id));
  }
  const hiddenRevision = (await call("catalog?sync=1", undefined, "client"))
    .data.revision;
  const legacy = {
    ...hidden,
    name: "TEST modification depuis un ancien onglet",
  };
  delete legacy.visible;
  assert.equal((await call("product-save", legacy)).status, 200);
  await restart();
  const preserved = (await call("catalog")).data.products.find(
    (p) => p.id === original.id,
  );
  assert.deepEqual(preserved, { ...legacy, visible: false });
  const unchanged = (
    await call("catalog?sync=1&revision=" + hiddenRevision, undefined, "client")
  ).data;
  assert.equal(
    unchanged.unchanged,
    true,
    "edits to a hidden product cannot affect the public revision",
  );
  assert.equal(unchanged.catalog, undefined);
  for (const visible of [null, "false", 0, {}])
    assert.equal(
      (await call("product-save", { ...preserved, visible })).status,
      400,
    );
  const deniedOrder = await call(
    "order-create",
    { ...payload, key: randomUUID() },
    "client",
  );
  assert.equal(deniedOrder.status, 400);
  assert.match(deniedOrder.data.error, /indisponible/);
  assert.equal((await call("orders-list", {}, "client")).data.length, 1);
  assert.equal(
    (await call("catalog")).data.products.find((p) => p.id === original.id)
      .stock_cartons,
    9,
  );

  const second = catalog.products.find((p) => p.id !== original.id);
  const upcoming = {
    ...second,
    upcoming: true,
    preorder_enabled: true,
    visible: true,
  };
  assert.equal((await call("product-save", upcoming)).status, 200);
  const request = {
    kind: "preorder",
    product_id: upcoming.id,
    cartons: 1,
    customer,
    details: { description: "TEST réservation", attachments: [] },
  };
  assert.equal(
    (await call("request-create", { request, key: randomUUID() }, "guest"))
      .status,
    200,
  );
  assert.equal(
    (await call("product-save", { ...upcoming, visible: false })).status,
    200,
  );
  for (const who of ["guest", "client"]) {
    const denied = await call(
      "request-create",
      { request, key: randomUUID() },
      who,
    );
    assert.equal(denied.status, 400);
    assert.match(denied.data.error, /Réservation non ouverte/);
  }
  assert.equal((await call("requests-list", {})).data.length, 1);
  assert.equal(
    (await call("product-save", { ...preserved, visible: true })).status,
    200,
  );
  const restored = (
    await call("catalog", undefined, "client")
  ).data.products.find((p) => p.id === original.id);
  assert.deepEqual(restored.images, original.images);
  assert.equal(restored.unit_price_cents, 1000);
  assert.equal(restored.visible, true);
  assert.equal(
    (await call("catalog")).data.products.length,
    catalog.products.length,
  );
  const image = await call(upload.data);
  assert.equal(image.status, 200);
  assert.deepEqual(image.data, png);
}
module.exports = { verifyProductVisibility };
