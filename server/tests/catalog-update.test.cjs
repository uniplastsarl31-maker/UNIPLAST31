const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createLocalStore } = require("../local-store.cjs");
const update = require("../catalog-update.json");

test("existing store migrates once, renames by stable reference, and preserves owner data and history", () => {
  const dataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-migration-test-"),
  );
  const dbPath = path.join(dataDir, "store.sqlite");
  try {
    createLocalStore({ dataDir }).close();
    let db = new DatabaseSync(dbPath);
    const change = update.products[0],
      other = update.products[1];
    const original = JSON.parse(
      db
        .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
        .get(change.id).body,
    );
    const old = {
      ...original,
      name: "Ancien nom du produit",
      name_fr: "Ancien nom du produit",
      unit_price_cents: 12345,
      available: false,
      availability_confirmed: true,
      stock_cartons: 3,
      images: [{ url: "/assets/owner-photo.png", scale: 1.2, x: 0, y: 5 }],
      weight_grams: 378.5,
    };
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(old),
      old.id,
    );
    const custom = JSON.parse(
      db
        .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
        .get(other.id).body,
    );
    custom.code = "REFERENCE-OWNER-CHANGED";
    custom.name = "Autre produit du propriétaire";
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(custom),
      custom.id,
    );
    const settings = JSON.parse(
      db.prepare("SELECT body FROM documents WHERE kind='settings'").get().body,
    );
    settings.phone = "0555 11 22 33";
    settings.about_body = "Présentation écrite par le propriétaire.";
    db.prepare("UPDATE documents SET body=? WHERE kind='settings'").run(
      JSON.stringify(settings),
    );
    db.prepare("INSERT INTO documents VALUES('order','old-order',?)").run(
      JSON.stringify({
        id: "old-order",
        items: [{ unit_price_cents: 500, name: "Nom historique" }],
        total_cents: 500,
      }),
    );
    db.prepare(
      "INSERT OR REPLACE INTO meta VALUES('admin','unchanged-owner-hash')",
    ).run();
    db.prepare(
      "INSERT INTO codes VALUES('client','Client','0770000000','unchanged-client-hash',1,7,'2026-10-01')",
    ).run();
    db.prepare("DELETE FROM meta WHERE key=?").run(
      "catalog-update:" + update.version,
    );
    db.prepare("DELETE FROM documents WHERE kind='catalog-backup'").run();
    db.close();
    createLocalStore({ dataDir }).close();
    db = new DatabaseSync(dbPath);
    const current = JSON.parse(
      db
        .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
        .get(old.id).body,
    );
    assert.equal(current.name, change.name);
    assert.equal(current.unit_price_cents, change.unit_price_cents);
    assert.equal(current.code, old.code);
    assert.deepEqual(current.images, old.images);
    assert.equal(current.available, false);
    assert.equal(current.stock_cartons, 3);
    assert.equal(current.weight_grams, 378.5);
    const savedSettings = JSON.parse(
      db.prepare("SELECT body FROM documents WHERE kind='settings'").get().body,
    );
    assert.equal(savedSettings.phone, settings.phone);
    assert.equal(savedSettings.about_body, settings.about_body);
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key='admin'").get().value,
      "unchanged-owner-hash",
    );
    assert.equal(
      db.prepare("SELECT hash FROM codes WHERE id='client'").get().hash,
      "unchanged-client-hash",
    );
    assert.equal(
      JSON.parse(
        db.prepare("SELECT body FROM documents WHERE kind='order'").get().body,
      ).items[0].unit_price_cents,
      500,
    );
    const backup = JSON.parse(
      db.prepare("SELECT body FROM documents WHERE kind='catalog-backup'").get()
        .body,
    );
    assert.deepEqual(
      backup.products.find((p) => p.id === old.id),
      old,
    );
    const report = JSON.parse(
      db
        .prepare("SELECT value FROM meta WHERE key=?")
        .get("catalog-update:" + update.version).value,
    );
    assert.equal(report.skipped[0].code, other.code);
    current.name = "Nom modifié après la mise à jour";
    current.unit_price_cents = 9876;
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(current),
      current.id,
    );
    db.close();
    createLocalStore({ dataDir }).close();
    db = new DatabaseSync(dbPath);
    assert.equal(
      JSON.parse(
        db
          .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
          .get(current.id).body,
      ).unit_price_cents,
      9876,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM documents WHERE kind='catalog-backup'")
        .get().n,
      1,
    );
    db.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
