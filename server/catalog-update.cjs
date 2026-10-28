const update = require("./catalog-update.json");

// Each release is applied once inside the same SQLite snapshot/CAS as all other writes.
// Stable IDs and references identify products; names are allowed to change.
function applyCatalogUpdate({ meta, setMeta, all, get, put, transaction }) {
  const key = "catalog-update:" + update.version;
  if (meta(key)) return;
  transaction(() => {
    const products = all("product");
    const settings = get("settings", "true");
    put("catalog-backup", {
      id: update.version,
      created_at: new Date().toISOString(),
      products,
      settings,
    });
    let renamed = 0,
      prices = 0,
      availability = 0;
    const skipped = [];
    for (const change of update.products) {
      const product = get("product", change.id);
      if (!product || product.code !== change.code) {
        skipped.push({ code: change.code, source_row: change.source_row });
        continue;
      }
      if (product.name !== change.name) renamed++;
      if (
        product.unit_price_cents !== change.unit_price_cents ||
        product.price_on_request !== change.price_on_request
      )
        prices++;
      Object.assign(product, {
        name: change.name,
        name_fr: change.name,
        unit_price_cents: change.unit_price_cents,
        price_on_request: change.price_on_request,
      });
      if (
        product.discount_price_cents !== null &&
        (product.price_on_request ||
          product.discount_price_cents >= product.unit_price_cents)
      ) {
        product.discount_price_cents = null;
        product.discount_start = null;
        product.discount_end = null;
      }
      put("product", product);
    }
    for (const product of all("product")) {
      let changed = false;
      if (!product.availability_confirmed && !product.upcoming) {
        product.availability_confirmed = true;
        product.available = product.stock_cartons !== 0;
        availability++;
        changed = true;
      }
      if (product.weight_grams === undefined) {
        product.weight_grams = null;
        changed = true;
      }
      if (changed) put("product", product);
    }
    const nextSettings = { ...settings };
    for (const [field, value] of Object.entries(update.company)) {
      if (
        !nextSettings[field] ||
        nextSettings[field] === update.previous_defaults[field]
      )
        nextSettings[field] = value;
    }
    put("settings", nextSettings);
    setMeta(
      key,
      JSON.stringify({
        version: update.version,
        applied_at: new Date().toISOString(),
        matched: update.products.length - skipped.length,
        renamed,
        prices,
        availability,
        skipped,
        review_count: update.review_count,
      }),
    );
  });
}
module.exports = { applyCatalogUpdate, catalogUpdateVersion: update.version };
