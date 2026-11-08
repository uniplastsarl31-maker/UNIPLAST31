const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const withoutImages = (product) => {
  const { images, ...rest } = product;
  return rest;
};

async function verifyProductImages({
  call,
  restart,
  site,
  beforeSave = (current) => current,
}) {
  const initial = (await call("catalog")).data;
  const stale = initial.products.find((p) => !p.price_on_request);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const publicImage = await call("upload?public=1", png, "admin", {
    binary: true,
  });
  const privateImage = await call("upload?public=0", png, "admin", {
    binary: true,
  });
  const pdf = await call(
    "upload?public=1",
    Buffer.from("%PDF-1.4 TEST"),
    "admin",
    { binary: true, type: "application/pdf" },
  );
  assert.equal(publicImage.status, 200);
  assert.equal(privateImage.status, 200);
  assert.equal(pdf.status, 200);
  const otherFamily = initial.families.find(
    (f) => f.id !== stale.family_id && f.kind !== "new",
  );
  assert(otherFamily);
  const fresh = {
    ...stale,
    name: "TEST nom récent du propriétaire",
    description: "TEST description récente",
    family_id: otherFamily.id,
    visible: false,
    unit_price_cents: 4321,
    discount_price_cents: null,
    weight_grams: 777.5,
    images: [{ url: publicImage.data, scale: 1, x: 0, y: 0 }],
  };
  assert.equal((await call("product-save", fresh)).status, 200);
  assert.equal(
    (await call("product-position", { id: fresh.id, position: 2 })).status,
    200,
  );
  const baseline = (await call("catalog")).data;
  const stored = baseline.products.find((p) => p.id === fresh.id);
  const photo = {
    url: publicImage.data,
    original_url: publicImage.data,
    scale: 1.7,
    x: 18,
    y: -24,
  };
  assert.equal(
    (await call("product-images", { id: stale.id, images: [photo] }, "guest"))
      .status,
    403,
  );
  assert.equal((await call("product-images", { images: [photo] })).status, 400);
  assert.equal(
    (await call("product-images", { id: "TEST-missing-product", images: [] }))
      .status,
    404,
  );
  const badLists = [
    undefined,
    null,
    {},
    Array(11).fill(photo),
    [null],
    [{}],
    [{ ...photo, scale: 0.49 }],
    [{ ...photo, scale: 3.01 }],
    [{ ...photo, scale: "1" }],
    [{ ...photo, x: -51 }],
    [{ ...photo, y: 51 }],
    [{ ...photo, x: null }],
    [{ ...photo, url: "javascript:alert(1)" }],
    [{ ...photo, url: "http://example.com/a.png" }],
    [{ ...photo, url: "https://user:secret@example.com/a.png" }],
    [{ ...photo, url: "blob:https://example.com/test" }],
    [{ ...photo, url: "/assets/../private.png" }],
    [{ ...photo, url: "/api/local/file?id=" + randomUUID() }],
    [{ ...photo, url: privateImage.data }],
    [{ ...photo, original_url: privateImage.data }],
    [{ ...photo, url: site + privateImage.data }],
    [{ ...photo, url: pdf.data }],
    [{ ...photo, url: "https://example.com/" + "a".repeat(2000) }],
  ];
  for (const images of badLists) {
    const result = await call("product-images", { id: stale.id, images });
    assert.equal(result.status, 400, JSON.stringify({ images, result }));
    assert.deepEqual(
      (await call("catalog")).data,
      baseline,
      "invalid photos must not alter any stored catalogue field",
    );
  }
  const images = [
    photo,
    { url: "/assets/crystal.webp", scale: 0.5, x: -50, y: 50 },
    {
      url: "https://images.example/test-owner-photo.jpg",
      scale: 3,
      x: 50,
      y: -50,
    },
  ];
  const expected = await beforeSave(stored);
  const updated = await call("product-images", {
    id: stale.id,
    images,
    // An older photo modal must never write these unrelated stale fields.
    name: stale.name,
    family_id: stale.family_id,
    unit_price_cents: 1,
    manual_position: null,
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data, { id: stale.id, images });
  await restart();
  let after = (await call("catalog")).data;
  assert.deepEqual(
    withoutImages(after.products.find((p) => p.id === stale.id)),
    withoutImages(expected),
  );
  assert.deepEqual(
    after.products.find((p) => p.id === stale.id).images,
    images,
  );
  assert.deepEqual(after.settings, baseline.settings);
  assert.deepEqual(after.families, baseline.families);
  assert.deepEqual(
    after.products.filter((p) => p.id !== stale.id),
    baseline.products.filter((p) => p.id !== stale.id),
  );
  assert.equal(after.products.length, baseline.products.length);
  const maximum = Array.from({ length: 10 }, (_, i) => ({
    url: publicImage.data,
    scale: 1,
    x: i,
    y: -i,
  }));
  assert.equal(
    (await call("product-images", { id: stale.id, images: maximum })).status,
    200,
  );
  assert.equal(
    (await call("product-images", { id: stale.id, images: [] })).status,
    200,
  );
  after = (await call("catalog")).data;
  assert.deepEqual(
    after.products.find((p) => p.id === stale.id),
    { ...expected, images: [] },
  );
  const bytes = await call(publicImage.data);
  assert.equal(bytes.status, 200);
  assert.deepEqual(
    bytes.data,
    png,
    "removing a photo from a product never deletes its uploaded original",
  );
}
module.exports = { verifyProductImages };
