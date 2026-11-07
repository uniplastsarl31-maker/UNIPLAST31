const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createLocalStore } = require("../local-store.cjs");
test("upgrading an existing unmarked store never reapplies historical catalogue or family migrations", () => {
  const dataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "uniplast-preserve-test-"),
    ),
    dbPath = path.join(dataDir, "store.sqlite");
  let db;
  try {
    createLocalStore({ dataDir }).close();
    db = new DatabaseSync(dbPath);
    const row = db
      .prepare("SELECT id,body FROM documents WHERE kind='product' LIMIT 1")
      .get();
    const product = {
      ...JSON.parse(row.body),
      name: "Nom récent du propriétaire",
      unit_price_cents: 912345,
      weight_grams: 808,
      images: [
        { url: "/api/local/file?id=owner-photo", scale: 1.1, x: 5, y: 8 },
      ],
    };
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(product),
      row.id,
    );
    db.prepare(
      "DELETE FROM meta WHERE key LIKE 'catalog-update:%' OR key LIKE 'family-update:%'",
    ).run();
    const before = db
      .prepare("SELECT kind,id,body FROM documents ORDER BY kind,id")
      .all();
    db.close();
    createLocalStore({ dataDir }).close();
    db = new DatabaseSync(dbPath);
    assert.deepEqual(
      db.prepare("SELECT kind,id,body FROM documents ORDER BY kind,id").all(),
      before,
    );
  } finally {
    if (db?.isOpen) db.close();
    const resolved = path.resolve(dataDir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith("uniplast-preserve-test-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
