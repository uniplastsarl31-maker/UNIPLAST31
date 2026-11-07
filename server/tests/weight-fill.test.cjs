const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { createLocalStore } = require("../local-store.cjs");
const { weightFillKey, weightFillVersion } = require("../weight-fill.cjs");
const seed = require("../generated/seed.json");
const family = {
  ...seed.families[0],
  id: "b3229077-1093-4f4a-9bf2-bc9d2283090c",
  name: "Famille du propriétaire",
  name_fr: "Famille du propriétaire",
};
const product = (code, weight) => ({
  ...seed.products[0],
  id: randomUUID(),
  name: "NOM DU PROPRIÉTAIRE " + code,
  name_fr: "Nom conservé",
  code,
  family_id: family.id,
  barcode: null,
  weight_grams: weight,
  unit_price_cents: 98765,
  available: true,
  availability_confirmed: true,
  images: [
    {
      url: "/api/local/file?id=4e00b88b-6cdb-469c-90ed-c454d1d5a7a0",
      original_url: "/api/local/file?id=c03ac878-67ae-4d90-8964-f369cd5419c1",
      scale: 1.25,
      x: -4,
      y: 7,
    },
  ],
  owner_notes: "Valeur supplémentaire conservée à l’identique.",
});
function cleanup(directory) {
  if (
    path.dirname(directory) === path.resolve(os.tmpdir()) &&
    path.basename(directory).startsWith("uniplast-weight-fill-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
}

test("fresh stores are explicitly skipped so a later restart cannot silently seed weights", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-weight-fill-"),
  );
  let db;
  try {
    const p = product("BCR12", null);
    createLocalStore({
      dataDir: directory,
      seedData: { products: [p], families: [family] },
    }).close();
    db = new DatabaseSync(path.join(directory, "store.sqlite"));
    const report = JSON.parse(
      db.prepare("SELECT value FROM meta WHERE key=?").get(weightFillKey).value,
    );
    assert.equal(report.mode, "fresh-store-skipped");
    assert.equal(report.filled, 0);
    assert.equal(
      JSON.parse(
        db.prepare("SELECT body FROM documents WHERE kind='product'").get()
          .body,
      ).weight_grams,
      null,
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM documents WHERE kind='weight-fill-backup'",
        )
        .get().n,
      0,
    );
    db.close();
    db = null;
    createLocalStore({ dataDir: directory }).close();
    db = new DatabaseSync(path.join(directory, "store.sqlite"));
    assert.equal(
      JSON.parse(
        db.prepare("SELECT body FROM documents WHERE kind='product'").get()
          .body,
      ).weight_grams,
      null,
    );
  } finally {
    if (db?.isOpen) db.close();
    cleanup(directory);
  }
});

test("existing-store fill matches all current unique references, keeps manual weights and every non-weight byte value, then stays idempotent", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-weight-fill-"),
  );
  let db;
  try {
    const products = [
      product("BCR12", null),
      product("BSRCS4", undefined),
      product("C2AC", ""),
      product("B10L", 777.5),
      product("OWNER-UNKNOWN", ""),
      product("B25L", null),
      product("b25l", ""),
      product(" bcr19 ", null),
      product("B30D", 0),
      product("B35L", " "),
    ];
    createLocalStore({
      dataDir: directory,
      seedData: { products, families: [family] },
    }).close();
    const file = path.join(directory, "store.sqlite");
    db = new DatabaseSync(file);
    db.prepare("DELETE FROM meta WHERE key=?").run(weightFillKey);
    const noField = { ...products[1] };
    delete noField.weight_grams;
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(noField),
      noField.id,
    );
    db.prepare("INSERT INTO documents VALUES('order','private-order',?)").run(
      JSON.stringify({
        id: "private-order",
        customer: { name: "Client privé" },
        items: [{ name: "Nom historique", unit_price_cents: 12345 }],
        total_cents: 12345,
      }),
    );
    db.prepare(
      "INSERT INTO documents VALUES('request','private-request',?)",
    ).run(
      JSON.stringify({
        id: "private-request",
        details: { description: "Projet privé" },
      }),
    );
    db.prepare(
      "INSERT OR REPLACE INTO meta VALUES('admin','private-owner-admin-hash')",
    ).run();
    db.prepare(
      "INSERT OR REPLACE INTO meta VALUES('transfer-code-hash','private-update-code-hash')",
    ).run();
    db.prepare(
      "INSERT INTO codes VALUES('client','Client','0770000000','private-pin-hash',1,4,'2026-11-01')",
    ).run();
    db.prepare(
      "INSERT INTO sessions VALUES('owner-session-token','admin','admin',1,9999999999999)",
    ).run();
    db.prepare(
      "INSERT INTO uploads VALUES('owner-photo','image/png','admin',1)",
    ).run();
    const allRows = (kind) =>
      db
        .prepare("SELECT id,body FROM documents WHERE kind=? ORDER BY id")
        .all(kind);
    const beforeProducts = allRows("product"),
      preservedKinds = [
        "order",
        "request",
        "family",
        "settings",
        "catalog-backup",
      ];
    const beforeOthers = Object.fromEntries(
      preservedKinds.map((kind) => [kind, allRows(kind)]),
    );
    const beforePrivate = Object.fromEntries(
      ["codes", "sessions", "uploads"].map((table) => [
        table,
        db.prepare("SELECT * FROM " + table).all(),
      ]),
    );
    db.close();
    db = null;
    const migrated = createLocalStore({ dataDir: directory });
    assert.equal(migrated.hasChanges(), true);
    migrated.close();
    db = new DatabaseSync(file);
    const byCode = new Map(
      allRows("product").map((row) => {
        const p = JSON.parse(row.body);
        return [p.code, p];
      }),
    );
    assert.equal(byCode.get("BCR12").weight_grams, 260); // PDF wins over Excel261.
    assert.equal(byCode.get("BSRCS4").weight_grams, 292); // Previously unmatched source row, now an existing owner product.
    assert.equal(byCode.get(" bcr19 ").weight_grams, 910); // PDF wins over Excel940.
    assert.equal(byCode.get("B10L").weight_grams, 777.5);
    assert.equal(byCode.get("B30D").weight_grams, 0);
    assert.equal(byCode.get("B35L").weight_grams, " ");
    assert.equal(byCode.get("C2AC").weight_grams, "");
    assert.equal(byCode.get("OWNER-UNKNOWN").weight_grams, "");
    assert.equal(byCode.get("B25L").weight_grams, null);
    assert.equal(byCode.get("b25l").weight_grams, "");
    for (const old of beforeProducts) {
      const before = JSON.parse(old.body),
        after = { ...byCode.get(before.code) };
      delete before.weight_grams;
      delete after.weight_grams;
      assert.equal(JSON.stringify(after), JSON.stringify(before));
    }
    assert.equal(allRows("product").length, beforeProducts.length);
    for (const kind of preservedKinds)
      assert.deepEqual(allRows(kind), beforeOthers[kind]);
    for (const table of ["codes", "sessions", "uploads"])
      assert.deepEqual(
        db.prepare("SELECT * FROM " + table).all(),
        beforePrivate[table],
      );
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key='admin'").get().value,
      "private-owner-admin-hash",
    );
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key='transfer-code-hash'").get()
        .value,
      "private-update-code-hash",
    );
    const rawReport = db
        .prepare("SELECT value FROM meta WHERE key=?")
        .get(weightFillKey).value,
      report = JSON.parse(rawReport);
    assert.deepEqual(
      {
        filled: report.filled,
        pdf: report.pdf,
        excel: report.excel,
        skipped: report.skipped,
        ambiguous: report.ambiguous,
      },
      { filled: 3, pdf: 2, excel: 1, skipped: 7, ambiguous: 2 },
    );
    const backup = JSON.parse(
      db
        .prepare(
          "SELECT body FROM documents WHERE kind='weight-fill-backup' AND id=?",
        )
        .get(weightFillVersion).body,
    );
    assert.equal(backup.changes.length, 3);
    assert.equal(
      backup.changes.find((c) => c.code === "BSRCS4").before.present,
      false,
    );
    assert(
      backup.changes.every(
        (c) => !Object.hasOwn(c, "images") && !Object.hasOwn(c, "customer"),
      ),
    );
    const cleared = { ...byCode.get("BCR12"), weight_grams: null };
    db.prepare("UPDATE documents SET body=? WHERE kind='product' AND id=?").run(
      JSON.stringify(cleared),
      cleared.id,
    );
    db.close();
    db = null;
    const reopened = createLocalStore({ dataDir: directory });
    assert.equal(reopened.hasChanges(), false);
    reopened.close();
    db = new DatabaseSync(file);
    assert.equal(
      JSON.parse(
        db
          .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
          .get(cleared.id).body,
      ).weight_grams,
      null,
    );
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key=?").get(weightFillKey).value,
      rawReport,
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM documents WHERE kind='weight-fill-backup'",
        )
        .get().n,
      1,
    );
  } finally {
    if (db?.isOpen) db.close();
    cleanup(directory);
  }
});
