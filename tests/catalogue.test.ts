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
} as Product;
test("phone-only budget filter uses the effective unit price and strict boundary", () => {
  const now = Date.now();
  const cheap = { ...product, unit_price_cents: 9999 };
  assert.equal(belowPrice(cheap, 10000, true, now), true);
  assert.equal(
    belowPrice({ ...cheap, unit_price_cents: 10000 }, 10000, true, now),
    false,
  );
  assert.equal(belowPrice(cheap, 10000, false, now), false);
  assert.equal(
    belowPrice({ ...cheap, price_hidden: true }, 10000, true, now),
    false,
  );
  assert.equal(
    belowPrice({ ...cheap, price_on_request: true }, 10000, true, now),
    false,
  );
  const discounted = {
    ...product,
    unit_price_cents: 20000,
    discount_price_cents: 9900,
    discount_start: new Date(now - 1000).toISOString(),
    discount_end: new Date(now + 1000).toISOString(),
  };
  assert.equal(belowPrice(discounted, 10000, true, now), true);
  assert.equal(belowPrice(discounted, 10000, true, now + 2000), false);
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
