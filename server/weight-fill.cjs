"use strict";
const source = require("../data/weights-2026-11-07.json");
const weightFillVersion = "2026-11-07-v1";
const weightFillKey = "weight-fill:" + weightFillVersion;
const codeOf = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
const validWeight = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 10000000;

function applyWeightFill({
  existingCatalog,
  meta,
  setMeta,
  all,
  put,
  transaction,
}) {
  if (meta(weightFillKey)) return;
  transaction(() => {
    const summary = {
      version: weightFillVersion,
      applied_at: new Date().toISOString(),
      mode: existingCatalog
        ? "existing-store-blank-fill"
        : "fresh-store-skipped",
      filled: 0,
      pdf: 0,
      excel: 0,
      skipped: 0,
      existing_weight: 0,
      unmatched: 0,
      missing_in_source: 0,
      ambiguous: 0,
      total: 0,
    };
    if (!existingCatalog) {
      setMeta(weightFillKey, JSON.stringify(summary));
      return;
    }
    const products = all("product"),
      liveCounts = new Map(),
      sourceRows = new Map();
    summary.total = products.length;
    for (const p of products)
      liveCounts.set(codeOf(p.code), (liveCounts.get(codeOf(p.code)) || 0) + 1);
    for (const row of source.source_rows) {
      const key = codeOf(row.code),
        rows = sourceRows.get(key) || [];
      rows.push(row);
      sourceRows.set(key, rows);
    }
    const changes = [];
    for (const product of products) {
      if (
        product.weight_grams !== null &&
        product.weight_grams !== undefined &&
        product.weight_grams !== ""
      ) {
        summary.existing_weight++;
        continue;
      }
      const code = codeOf(product.code),
        rows = sourceRows.get(code);
      if (!rows) {
        summary.unmatched++;
        continue;
      }
      if (liveCounts.get(code) !== 1 || rows.length !== 1) {
        summary.ambiguous++;
        continue;
      }
      const row = rows[0],
        fromPdf = validWeight(row.pdf_weight_grams);
      const value = fromPdf ? row.pdf_weight_grams : row.excel_weight_grams;
      if (!validWeight(value)) {
        summary.missing_in_source++;
        continue;
      }
      changes.push({
        product_id: product.id,
        code: product.code,
        before: {
          present: Object.prototype.hasOwnProperty.call(
            product,
            "weight_grams",
          ),
          value: product.weight_grams ?? null,
        },
        after: { weight_grams: value },
        source: fromPdf ? "PDF" : "Excel",
        source_row: row.source_row,
        source_page: row.page,
      });
      // All other properties retain their exact existing values, including photos.
      put("product", { ...product, weight_grams: value });
      summary.filled++;
      summary[fromPdf ? "pdf" : "excel"]++;
    }
    summary.skipped = summary.total - summary.filled;
    put("weight-fill-backup", {
      id: weightFillVersion,
      created_at: summary.applied_at,
      source_file: source.source_file,
      source_sha256: source.source_sha256,
      changes,
      summary,
    });
    setMeta(weightFillKey, JSON.stringify(summary));
  });
}
module.exports = { applyWeightFill, weightFillVersion, weightFillKey };
