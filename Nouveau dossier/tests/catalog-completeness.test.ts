import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/catalog.json" with { type: "json" };
import type { Product } from "../src/types.ts";
import {
  completenessCounts,
  matchesCompletenessFilter,
  missingProductData,
} from "../src/catalogCompleteness.ts";

const complete = {
  ...seed.products[0],
  barcode: "6134338000001",
  images: [{ url: "/api/local/file?id=test-photo", scale: 1, x: 0, y: 0 }],
  weight_grams: 378,
  price_on_request: false,
  unit_price_cents: 10000,
  dimensions: "10 × 20 cm",
  material: "PP",
} as Product;

test("missing-data review counts each product once and reports overlapping fields", () => {
  const noPhotoOrWeight = { ...complete, images: [], weight_grams: null };
  const noDetails = {
    ...complete,
    dimensions: " ",
    material: "\n",
    barcode: " ",
  };
  const products = [complete, noPhotoOrWeight, noDetails];
  assert.deepEqual(completenessCounts(products), {
    "": 3,
    missing: 2,
    photo: 1,
    barcode: 1,
    weight: 1,
    price: 0,
    dimensions: 1,
    material: 1,
  });
  assert.deepEqual(
    products.filter((p) => matchesCompletenessFilter(p, "missing")),
    [noPhotoOrWeight, noDetails],
  );
  assert.deepEqual(
    products.filter((p) => matchesCompletenessFilter(p, "photo")),
    [noPhotoOrWeight],
  );
  assert.equal(matchesCompletenessFilter(complete, ""), true);
  assert.deepEqual(missingProductData(complete), []);
});

test("empty or invalid current fields remain incomplete despite legacy metadata", () => {
  for (const weight of [null, undefined, "", 0, -1, NaN, Infinity]) {
    const product = {
      ...complete,
      weight_grams: weight,
      source_metadata: { ...complete.source_metadata!, weight: "999" },
    } as Product;
    assert.equal(matchesCompletenessFilter(product, "weight"), true);
  }
  assert.equal(
    matchesCompletenessFilter({ ...complete, weight_grams: 0.5 }, "weight"),
    false,
  );
  assert.equal(
    matchesCompletenessFilter(
      { ...complete, images: [{ ...complete.images[0], url: " " }] },
      "photo",
    ),
    true,
  );
  assert.equal(
    matchesCompletenessFilter(
      {
        ...complete,
        images: [{ ...complete.images[0], url: " " }, complete.images[0]],
      },
      "photo",
    ),
    false,
  );
  assert.equal(
    matchesCompletenessFilter({ ...complete, price_on_request: true }, "price"),
    true,
  );
  for (const unit_price_cents of [0, -1, NaN, Infinity])
    assert.equal(
      matchesCompletenessFilter({ ...complete, unit_price_cents }, "price"),
      true,
    );
});

test("review filters preserve all product data and can operate on a selected subset", () => {
  const products = [
    structuredClone(complete),
    { ...structuredClone(complete), id: "second", barcode: null },
  ];
  const before = structuredClone(products);
  const subset = products.filter((p) => p.id === "second");
  assert.equal(completenessCounts(subset).barcode, 1);
  assert.equal(completenessCounts(subset)[""], 1);
  for (const p of products) {
    missingProductData(p);
    matchesCompletenessFilter(p, "missing");
  }
  assert.deepEqual(products, before);
});
