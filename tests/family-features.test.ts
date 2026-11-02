import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNewProduct,
  matchesFamily,
  productSpecifications,
  defaultCustomOrder,
  validateCustomItems,
  validateFeatureSettings,
} from "../src/domain.ts";
import seed from "../src/data/catalog.json" with { type: "json" };
import type { Family, Product, Settings } from "../src/types.ts";
const p = {
  ...seed.products[0],
  is_new: true,
  material: "PP",
  dimensions: "20 × 10 cm",
  weight_grams: 120.5,
} as Product;
const settings = {
  product_display: { weight: false, material: false, hide_empty: true },
} as Settings;
test("new collection overlaps the main family and expiry removes only new status", () => {
  const now = Date.parse("2026-11-02T10:00Z");
  const end = { ...p, new_until: "2026-11-03T10:00Z" };
  const collection = { id: "new", kind: "new" } as Family;
  const main = { id: p.family_id } as Family;
  assert(isNewProduct(end, now));
  assert(matchesFamily(end, collection, now));
  assert(matchesFamily(end, main, now));
  assert(!isNewProduct(end, Date.parse(end.new_until)));
  assert(matchesFamily(end, main, Date.parse(end.new_until)));
  assert(!isNewProduct({ ...p, is_new: false }, now));
  assert(isNewProduct({ ...p, new_until: null }, now));
});
test("display options hide weight/material without mutating the stored product; empty rows stay optional", () => {
  const original = structuredClone(p),
    rows = productSpecifications(p, settings);
  assert(!rows.some(([k]) => ["Poids unitaire", "Matière"].includes(k)));
  assert(rows.some(([k, v]) => k === "Dimensions" && v === p.dimensions));
  assert.deepEqual(p, original);
  assert(
    productSpecifications(p, {} as Settings).some(
      ([k, v]) => k === "Poids unitaire" && v.includes("120,5"),
    ),
  );
  const noCapacity = { ...p, capacity: "" };
  assert(
    !productSpecifications(noCapacity, settings).some(
      ([k]) => k === "Capacité",
    ),
  );
  assert(
    productSpecifications(noCapacity, {
      product_display: { hide_empty: false },
    } as Settings).some(([k, v]) => k === "Capacité" && v === "Non renseigné"),
  );
});
test("manufacturing minimum is explicit per article or total, with optional photos and written acceptance", () => {
  const items = [
    { name: "Boîte", quantity_units: 600, images: [] },
    { name: "Couvercle", quantity_units: 400, images: [] },
  ];
  const c = {
    ...defaultCustomOrder,
    min_units: 1000,
    terms: "Conditions de test",
  };
  assert.match(validateCustomItems(items, c, true)!, /par article/);
  assert.equal(
    validateCustomItems(items, { ...c, minimum_scope: "total" }, true),
    null,
  );
  assert.match(
    validateCustomItems(items, { ...c, minimum_scope: "total" })!,
    /accepter/,
  );
  assert.match(
    validateCustomItems(items, { ...defaultCustomOrder, require_photo: true })!,
    /photo/,
  );
  assert.match(
    validateCustomItems(items, { ...defaultCustomOrder, enabled: false })!,
    /fermées/,
  );
  assert.equal(validateCustomItems(items, defaultCustomOrder), null);
  for (const n of [0, -1, 1.5, NaN, Infinity, 10000001])
    assert(
      validateCustomItems(
        [{ ...items[0], quantity_units: n }],
        defaultCustomOrder,
      ),
    );
  assert(
    validateFeatureSettings({
      custom_order: { ...defaultCustomOrder, min_units: -1 },
    }),
  );
});
