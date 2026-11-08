import { test } from "node:test";
import assert from "node:assert/strict";
import {
  belowPrice,
  compareProductNames,
  findBarcodeProduct,
  validateProduct,
} from "../src/domain.ts";
import { detectFileType, validatedFile } from "../src/fileFormats.ts";
import seed from "../src/data/catalog.json" with { type: "json" };
import type { Product } from "../src/types.ts";

const product = {
  ...seed.products[0],
  available: true,
  availability_confirmed: true,
  price_hidden: false,
  price_on_request: false,
  discount_price_cents: null,
  discount_start: null,
  discount_end: null,
} as Product;
test("approved budget includes exact 50 DA and 100 DA boundaries, excludes one cent above", () => {
  const now = Date.UTC(2026, 10, 8);
  for (const maximum of [5000, 10000]) {
    assert.equal(
      belowPrice(
        { ...product, unit_price_cents: maximum - 1 },
        maximum,
        true,
        now,
      ),
      true,
    );
    assert.equal(
      belowPrice({ ...product, unit_price_cents: maximum }, maximum, true, now),
      true,
    );
    assert.equal(
      belowPrice(
        { ...product, unit_price_cents: maximum + 1 },
        maximum,
        true,
        now,
      ),
      false,
    );
  }
});
test("budget rejects guests, protected prices, prices on request and invalid limits", () => {
  const now = Date.UTC(2026, 10, 8),
    cheap = { ...product, unit_price_cents: 5000 };
  assert.equal(belowPrice(cheap, 10000, false, now), false);
  assert.equal(
    belowPrice({ ...cheap, price_hidden: true }, 10000, true, now),
    false,
  );
  assert.equal(
    belowPrice({ ...cheap, price_on_request: true }, 10000, true, now),
    false,
  );
  for (const maximum of [
    -1,
    0,
    NaN,
    Infinity,
    5000.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(belowPrice(cheap, maximum, true, now), false);
});
test("budget compares the active discounted price including its boundary, then restores regular price", () => {
  const now = Date.UTC(2026, 10, 8);
  const discounted = {
    ...product,
    unit_price_cents: 20000,
    discount_price_cents: 5000,
    discount_start: new Date(now - 1000).toISOString(),
    discount_end: new Date(now + 1000).toISOString(),
  };
  assert.equal(belowPrice(discounted, 5000, true, now), true);
  assert.equal(belowPrice(discounted, 4999, true, now), false);
  assert.equal(belowPrice(discounted, 5000, true, now - 2000), false);
  assert.equal(belowPrice(discounted, 5000, true, now + 2000), false);
});
test("French alphabetical order is independent of pins and availability", () => {
  const list = ["ZÈBRE", "éponge", "BOÎTE 10", "Bassine", "BOITE 2"].map(
    (name) => ({ ...product, name }),
  );
  assert.deepEqual(
    list.sort(compareProductNames).map((p) => p.name),
    ["Bassine", "BOITE 2", "BOÎTE 10", "éponge", "ZÈBRE"],
  );
});
test("Crystal reference numbers sort naturally despite the actual RC 10 versus RC01 name spacing", () => {
  const list = [
    {
      ...product,
      code: "BCR10D",
      name: "BOITE CRYSTAL RC 10 MAXI REF 02 DECOREE",
    },
    { ...product, code: "BCR11", name: "BOITE CRYSTAL RC11 REF 03 MINI" },
    { ...product, code: "BCR02", name: "BOITE CRYSTAL RC02 MAXI" },
    { ...product, code: "BCR01", name: "BOITE CRYSTAL RC01 MINI" },
    { ...product, code: "BCR09", name: "BOITE CRYSTAL RC09 REF 02 MINI" },
  ];
  assert.deepEqual(
    list.sort(compareProductNames).map((p) => p.code),
    ["BCR01", "BCR02", "BCR09", "BCR10D", "BCR11"],
  );
  assert.equal(
    list.find((p) => p.code === "BCR10D")?.name,
    "BOITE CRYSTAL RC 10 MAXI REF 02 DECOREE",
  );
});
test("equivalent accents and reference spacing use the numeric product code as tie-breaker", () => {
  const list = [
    { ...product, code: "REF10", name: "BOÎTE CRYSTAL RC 02" },
    { ...product, code: "REF2", name: "BOITE CRYSTAL RC02" },
  ];
  assert.deepEqual(
    list.sort(compareProductNames).map((p) => p.code),
    ["REF2", "REF10"],
  );
});
test("scan matches printed digits, Arabic numerals, GS1 scanner prefixes and equivalent UPC/EAN", () => {
  const p = { ...product, barcode: "0613433800001" };
  assert.equal(findBarcodeProduct([p], "]E0 0613 4338 00001")?.id, p.id);
  assert.equal(findBarcodeProduct([p], "613433800001")?.id, p.id);
  assert.equal(findBarcodeProduct([p], "٠٦١٣٤٣٣٨٠٠٠٠١")?.id, p.id);
  assert.equal(findBarcodeProduct([p], "613433800002"), undefined);
  assert.equal(findBarcodeProduct([p], ""), undefined);
});
test("PNG bytes are accepted even with uppercase extension or empty/nonstandard MIME", async () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  assert.equal(detectFileType(png), "image/png");
  assert.equal(
    (await validatedFile(new File([png], "photo.PNG"), 4)).type,
    "image/png",
  );
  assert.equal(
    (
      await validatedFile(
        new File([png], "photo.png", { type: "image/x-png" }),
        4,
      )
    ).type,
    "image/png",
  );
  await assert.rejects(
    validatedFile(
      new File(["<html>fake</html>"], "photo.png", { type: "image/png" }),
      4,
    ),
    /véritable/,
  );
  await assert.rejects(
    validatedFile(
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png"),
      4,
    ),
    /volumineux/,
  );
});
test("weight stays optional and rejects negative, zero and non-finite values", () => {
  assert.equal(validateProduct({ ...product, weight_grams: null }), null);
  assert.equal(validateProduct({ ...product, weight_grams: 378.5 }), null);
  for (const weight_grams of [-1, 0, NaN, Infinity])
    assert.match(validateProduct({ ...product, weight_grams })!, /poids/);
});
