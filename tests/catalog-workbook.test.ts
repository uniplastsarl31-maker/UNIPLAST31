import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCatalogWorkbook,
  parseCatalogWorkbook,
  preflightWorkbook,
  WORKBOOK_COLUMNS,
} from "../src/catalogWorkbook.ts";
import seed from "../src/data/catalog.json" with { type: "json" };
import type { Family, Product } from "../src/types.ts";
const product = {
  ...seed.products[0],
  weight_grams: 378.5,
  barcode: "0012345678901",
  unit_price_cents: 1999,
  images: [{ url: "/assets/owner.png", scale: 1.3, x: 2, y: -3 }],
} as Product;
const source = {
  export_id: "export-test-only",
  created_at: "2026-11-07T12:00:00.000Z",
  products: [product],
  families: seed.families as Family[],
};
const column = (field: string) =>
  WORKBOOK_COLUMNS.findIndex((c) => c.field === field) + 3;
async function read(bytes: ArrayBuffer) {
  const { default: ExcelJS } = await import("exceljs");
  const b = new ExcelJS.Workbook();
  await b.xlsx.load(bytes as never);
  return b;
}
async function bytes(book: Awaited<ReturnType<typeof read>>) {
  return new Uint8Array(await book.xlsx.writeBuffer()).slice().buffer;
}
test("catalogue Excel roundtrip preserves gram precision, leading barcode zeros and price cents; photo fields never import", async () => {
  const data = await createCatalogWorkbook(source),
    imported = await parseCatalogWorkbook(data, "all");
  assert.equal(imported.export_id, source.export_id);
  assert.equal(imported.rows[0].id, product.id);
  assert.equal(imported.rows[0].code, product.code);
  assert.equal(imported.rows[0].values.weight_grams, 378.5);
  assert.equal(imported.rows[0].values.unit_price_cents, 1999);
  assert.equal(imported.rows[0].values.barcode, "0012345678901");
  assert.equal(imported.rows[0].values.family_id, product.family_id);
  assert.equal(imported.rows[0].values.images, undefined);
  assert.equal(imported.rows[0].values.source_metadata, undefined);
  const book = await read(data);
  assert.equal(book.worksheets[0].name, "Produits");
  assert.match(
    String(
      book
        .getWorksheet("Produits")!
        .getRow(2)
        .getCell(WORKBOOK_COLUMNS.length + 4).value,
    ),
    /owner.png/,
  );
});
test("weights-only import accepts French decimals and leaves other columns outside the patch", async () => {
  const book = await read(await createCatalogWorkbook(source)),
    sheet = book.getWorksheet("Produits")!;
  sheet.getCell(2, column("weight_grams")).value = "379,75";
  sheet.getCell(2, column("name")).value =
    "Changed name ignored in weights mode";
  sheet.getCell(2, column("unit_price_cents")).value = "not a price";
  const imported = await parseCatalogWorkbook(await bytes(book), "weights");
  assert.deepEqual(imported.rows[0].values, { weight_grams: 379.75 });
  await assert.rejects(
    parseCatalogWorkbook(await bytes(book), "all"),
    /Nombre invalide/,
  );
});
test("unsafe and unrelated workbooks, formulas and repeated references are refused", async () => {
  assert.throws(() => preflightWorkbook(new Uint8Array([1, 2, 3])), /xlsx/);
  assert.throws(
    () => preflightWorkbook(new Uint8Array(3 * 1024 * 1024 + 1)),
    /3 Mo/,
  );
  const b = await read(await createCatalogWorkbook(source)),
    sheet = b.getWorksheet("Produits")!;
  sheet.getCell(2, column("weight_grams")).value = {
    formula: "1+1",
    result: 2,
  };
  await assert.rejects(parseCatalogWorkbook(await bytes(b)), /formules/);
  const repeated = await createCatalogWorkbook({
    ...source,
    products: [product, product],
  });
  await assert.rejects(parseCatalogWorkbook(repeated), /répété/);
});
