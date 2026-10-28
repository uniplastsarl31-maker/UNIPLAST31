import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  activeDiscount,
  canBuy,
  cartTotals,
  normalizeSearch,
  orderLine,
  priceOf,
  rankProducts,
  salesStats,
  validateProduct,
  activeSeasons,
  safeWebUrl,
} from "../src/domain.ts";
import type { Order, Product } from "../src/types.ts";
test("season windows use shop local dates, inclusive ends and explicit activation", () => {
  const s = {
    id: "summer",
    title: "Été",
    description: "",
    starts_on: "2026-06-01",
    ends_on: "2026-08-31",
    visible: true,
    product_ids: [],
    family_ids: [],
  };
  assert.equal(
    activeSeasons([s], "Africa/Algiers", Date.parse("2026-05-31T23:00:00Z"))
      .length,
    1,
  );
  assert.equal(
    activeSeasons([s], "Africa/Algiers", Date.parse("2026-08-31T22:59:59Z"))
      .length,
    1,
  );
  assert.equal(
    activeSeasons([s], "Africa/Algiers", Date.parse("2026-08-31T23:00:00Z"))
      .length,
    0,
  );
  assert.equal(
    activeSeasons(
      [{ ...s, visible: false }],
      "Africa/Algiers",
      Date.parse("2026-07-01T12:00Z"),
    ).length,
    0,
  );
});
test("public company links accept HTTPS without embedded credentials", () => {
  assert.equal(
    safeWebUrl("https://www.facebook.com/uniplast"),
    "https://www.facebook.com/uniplast",
  );
  for (const u of [
    "javascript:alert(1)",
    "data:text/html,example",
    "https://user:pass@example.com",
    "http://example.com",
  ])
    assert.equal(safeWebUrl(u), "");
});

const imported = JSON.parse(
  await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"),
);
const fixture: Product = {
  ...imported.products[0],
  available: true,
  availability_confirmed: true,
  price_on_request: false,
  unit_price_cents: 2000,
  pack_size: 10,
  stock_cartons: 100,
};
test("redacted prices cannot create a cart line or purchase", () => {
  const hidden = { ...fixture, price_hidden: true, unit_price_cents: 0 };
  assert.equal(canBuy(hidden), false);
  assert.throws(() => orderLine(hidden, 1), /agréé/);
});
test("cartons, pieces, unit prices and delivery remain distinct", () => {
  const line = orderLine(fixture, 5);
  assert.equal(line.total_units, 50);
  assert.equal(line.carton_price_cents, 20000);
  assert.equal(line.total_cents, 100000);
  const other = {
    ...fixture,
    id: "other",
    unit_price_cents: 2023,
    pack_size: 3,
  };
  const t = cartTotals(
    [
      { product_id: fixture.id, cartons: 5 },
      { product_id: "other", cartons: 2 },
    ],
    [fixture, other],
    5000,
  );
  assert.equal(t.cartons, 7);
  assert.equal(t.units, 56);
  assert.equal(t.total, 117138); // 100000 + 12138 + 5000 centimes.
});
test("scheduled discounts use an inclusive start and exclusive end; no expired price survives", () => {
  const p = {
    ...fixture,
    discount_price_cents: 1600,
    discount_start: "2026-10-01T00:00:00Z",
    discount_end: "2026-10-02T00:00:00Z",
  };
  assert.equal(activeDiscount(p, Date.parse(p.discount_start) - 1), false);
  assert.equal(priceOf(p, Date.parse(p.discount_start)), 1600);
  assert.equal(priceOf(p, Date.parse(p.discount_end)), 2000);
  assert.equal(
    orderLine(p, 5, Date.parse(p.discount_start)).discount_cents,
    20000,
  );
  assert.ok(validateProduct({ ...p, discount_price_cents: -1 }));
  assert.ok(validateProduct({ ...p, discount_price_cents: 2500 }));
});
test("unknown availability, out-of-stock, upcoming and absent price each prevent purchase", () => {
  assert.equal(canBuy(fixture), true);
  for (const patch of [
    { available: false },
    { availability_confirmed: false },
    { upcoming: true },
    { stock_cartons: 0 },
    { price_on_request: true },
  ])
    assert.equal(canBuy({ ...fixture, ...patch }), false);
  assert.throws(() => orderLine(fixture, 0));
  assert.throws(() => orderLine(fixture, 1.5));
});
test("French accents and Arabic spelling/diacritics normalize without changing identifiers", () => {
  assert.equal(normalizeSearch("ÉGOUTTOIR"), "egouttoir");
  assert.equal(normalizeSearch("أُونِيبْلَاسْت"), "اونيبلاست");
  assert.equal(normalizeSearch("علبة"), "علبه");
  assert.equal(normalizeSearch("٦١٣٤٣٣٨٠٠٠٠١٣"), "6134338000013");
});
test("ranking uses explicit manual pins, availability and actual completed sales", () => {
  const a = { ...fixture, id: "a", pinned: false, sort_order: 0 },
    b = { ...fixture, id: "b", pinned: false, sort_order: 1 },
    c = { ...fixture, id: "c", pinned: true, sort_order: 2 };
  assert.deepEqual(
    rankProducts([a, b, c], { b: 5 }).map((p) => p.id),
    ["c", "b", "a"],
  );
});
test("cancelled, new, preorder and preview activity never increases sales", () => {
  const line = orderLine(fixture, 2),
    base = {
      id: "o",
      reference: "TEST",
      user_id: "u",
      created_at: "2026-10-01T00:00:00Z",
      status: "confirmed",
      items: [line],
      total_cents: line.total_cents,
    } as Order;
  const stats = salesStats([
    base,
    { ...base, status: "cancelled" },
    { ...base, status: "new" },
    { ...base, preview: true },
  ]);
  assert.equal(stats.count, 1);
  assert.equal(stats.revenue, 40000);
  assert.equal(stats.cartons, 2);
  assert.equal(stats.units, 20);
});
test("the imported catalogue is complete and linked; the original CSV remains byte-identical", async () => {
  const report = JSON.parse(
    await readFile(
      new URL("../docs/import-report.json", import.meta.url),
      "utf8",
    ),
  );
  const source = await readFile(
    new URL("../data/uniplast_produits.csv", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    report.sha256,
  );
  assert.equal(imported.products.length, 350);
  assert.equal(imported.families.length, 17);
  assert.equal(
    new Set(imported.products.map((p: Product) => p.code.toLowerCase())).size,
    350,
  );
  assert.ok(
    imported.products.every((p: Product) =>
      imported.families.some((f: { id: string }) => f.id === p.family_id),
    ),
  );
  assert.equal(
    imported.products.filter((p: Product) => p.price_on_request).length,
    34,
  );
  assert.ok(
    imported.products.every(
      (p: Product) =>
        !p.availability_confirmed &&
        !p.is_new &&
        !p.upcoming &&
        p.discount_price_cents === null,
    ),
  );
  const bars = imported.products.map((p: Product) => p.barcode).filter(Boolean);
  assert.equal(new Set(bars).size, bars.length);
});
