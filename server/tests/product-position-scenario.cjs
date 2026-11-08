const assert = require("node:assert/strict");
const {
  orderedCatalogueProducts,
} = require("../generated/productOrdering.cjs");

const stripPosition = (product) => {
  const { manual_position, ...rest } = product;
  return rest;
};
async function verifyProductPosition({ call, restart, beforeMove = () => {} }) {
  const initial = (await call("catalog")).data;
  const family = initial.families.find(
    (f) => initial.products.filter((p) => p.family_id === f.id).length >= 8,
  );
  assert(family);
  const members = orderedCatalogueProducts(
    initial.products,
    initial.families,
  ).filter((p) => p.family_id === family.id);
  const target = members[4],
    second = members.at(-1);
  const outside = initial.products.find((p) => p.family_id !== family.id);
  assert(target && second && outside && target.id !== second.id);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const upload = await call("upload?public=1", png, "admin", { binary: true });
  assert.equal(upload.status, 200);
  const ownerProduct = {
    ...target,
    images: [{ url: upload.data, scale: 1.8, x: 17, y: -24 }],
  };
  assert.equal((await call("product-save", ownerProduct)).status, 200);
  assert.equal(
    (await call("product-save", { ...ownerProduct, manual_position: 7 }))
      .status,
    200,
  );
  const unpositioned = (await call("catalog")).data.products.find(
    (p) => p.id === target.id,
  );
  assert.equal(unpositioned.manual_position, target.manual_position);
  assert.equal(
    Object.prototype.hasOwnProperty.call(unpositioned, "manual_position"),
    Object.prototype.hasOwnProperty.call(target, "manual_position"),
    "content saves cannot introduce a manual anchor on an existing automatic product",
  );
  assert.equal(
    (await call("product-position", { id: outside.id, position: 1 })).status,
    200,
  );
  const before = (await call("catalog")).data;
  const assertOwnerData = async () => {
    const actual = (await call("catalog")).data;
    assert.deepEqual(
      actual.products.map(stripPosition),
      before.products.map(stripPosition),
      "only manual_position may change",
    );
    assert.deepEqual(actual.families, before.families);
    assert.deepEqual(actual.settings, before.settings);
    assert.equal(actual.products.length, before.products.length);
    return actual;
  };
  assert.equal(
    (await call("product-position", { id: target.id, position: 2 }, "guest"))
      .status,
    403,
  );
  for (const position of [
    undefined,
    0,
    -1,
    1.5,
    "2",
    {},
    1000001,
    Number.MAX_SAFE_INTEGER,
  ]) {
    assert.equal(
      (await call("product-position", { id: target.id, position })).status,
      400,
    );
  }
  assert.equal((await call("product-position", { position: 2 })).status, 400);
  assert.equal(
    (await call("product-position", { id: "TEST-product-absent", position: 2 }))
      .status,
    404,
  );
  beforeMove();
  const moved = await call("product-position", { id: target.id, position: 2 });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.id, target.id);
  assert.equal(moved.data.position, 2);
  assert(moved.data.updated >= 1);
  await restart();
  let current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    2,
  );
  assert.equal(
    orderedCatalogueProducts(current.products, current.families).filter(
      (p) => p.family_id === family.id,
    )[1].id,
    target.id,
  );

  assert.equal(
    (await call("product-position", { id: second.id, position: 2 })).status,
    200,
  );
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === second.id).manual_position,
    2,
  );
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    3,
    "inserting at an occupied position shifts the existing anchor",
  );
  assert.equal(
    current.products.find((p) => p.id === outside.id).manual_position,
    1,
    "another family's anchor stays intact",
  );
  let ordered = orderedCatalogueProducts(
    current.products,
    current.families,
  ).filter((p) => p.family_id === family.id);
  assert.equal(ordered[1].id, second.id);
  assert.equal(ordered[2].id, target.id);
  assert.equal(
    (await call("product-position", { id: target.id, position: 1 })).status,
    200,
  );
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    1,
  );
  assert.equal(
    current.products.find((p) => p.id === second.id).manual_position,
    3,
  );

  // This older full-product form knows nothing about the newer ordering field.
  const legacy = { ...ownerProduct };
  delete legacy.manual_position;
  assert.equal((await call("product-save", legacy)).status, 200);
  for (const manual_position of [null, 2]) {
    assert.equal(
      (await call("product-save", { ...legacy, manual_position })).status,
      200,
    );
    assert.equal(
      (await call("catalog")).data.products.find((p) => p.id === target.id)
        .manual_position,
      1,
      "stale explicit positions cannot reset or move a current anchor",
    );
  }
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    1,
  );
  for (const manual_position of [0, -1, 1.5, "2", {}, 1000001])
    assert.equal(
      (await call("product-save", { ...legacy, manual_position })).status,
      400,
    );

  const cleared = await call("product-position", {
    id: second.id,
    position: null,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.position, null);
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === second.id).manual_position,
    null,
  );
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    1,
  );
  assert.equal(
    current.products.find((p) => p.id === outside.id).manual_position,
    1,
  );
  assert.equal(
    (await call("product-position", { id: target.id, position: 1000000 }))
      .status,
    200,
  );
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    members.length,
    "large valid positions clamp to the actual family size",
  );
  assert.equal(
    (await call("product-position", { id: target.id, position: null })).status,
    200,
  );
  assert.equal(
    (await call("product-position", { id: outside.id, position: null })).status,
    200,
  );
  assert.equal((await call("product-save", legacy)).status, 200);
  assert.equal(
    (await call("product-save", { ...legacy, manual_position: 1 })).status,
    200,
  );
  await restart();
  current = await assertOwnerData();
  assert.equal(
    current.products.find((p) => p.id === target.id).manual_position,
    null,
    "legacy saves also preserve the explicit automatic reset",
  );
  ordered = orderedCatalogueProducts(current.products, current.families).filter(
    (p) => p.family_id === family.id,
  );
  assert.deepEqual(
    ordered.map((p) => p.id),
    members.map((p) => p.id),
  );
  const image = await call(upload.data);
  assert.equal(image.status, 200);
  assert.deepEqual(image.data, png);
}
module.exports = { verifyProductPosition };
