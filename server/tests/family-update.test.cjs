const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createLocalStore } = require("../local-store.cjs");
const {
  familyUpdateVersion,
  planFamilyUpdate,
  familyIds,
} = require("../family-update.cjs");
const seed = require("../generated/seed.json");

test("family migration preserves catalogue values, private history, credentials and owner edits across restarts", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-families-test-"),
  );
  let db;
  try {
    createLocalStore({ dataDir: directory, preserveExistingCatalog: false }).close();
    db = new DatabaseSync(path.join(directory, "store.sqlite"));
    db.prepare(
      "DELETE FROM documents WHERE kind='family' OR kind='family-backup'",
    ).run();
    db.prepare("DELETE FROM meta WHERE key=?").run(
      "family-update:" + familyUpdateVersion,
    );
    const save = (kind, value) =>
      db
        .prepare("INSERT OR REPLACE INTO documents VALUES(?,?,?)")
        .run(kind, String(value.id), JSON.stringify(value));
    seed.families.forEach((f) => save("family", f));
    const crystal = seed.families.find((f) => f.name === "Boîtes Crystal");
    save("family", {
      ...crystal,
      slides: [
        {
          id: "owner-slide",
          title: "Visuel du propriétaire",
          image: "/assets/owner-banner.png",
          body: "",
          cta: "Voir",
          eyebrow: "",
          family_id: crystal.id,
          visible: true,
        },
      ],
    });
    const products = seed.products.map((p) => ({
      ...p,
      unit_price_cents: 8765,
      weight_grams: 378.5,
      images: [{ url: "/assets/owner-image.png", scale: 1.2, x: 3, y: -5 }],
    }));
    products.forEach((p) => save("product", p));
    const historic = {
      id: "historic",
      customer: { name: "Client privé" },
      items: [
        {
          name: "Nom historique",
          family_id: seed.families[0].id,
          unit_price_cents: 1234,
        },
      ],
    };
    save("order", historic);
    save("request", historic);
    const settings = JSON.parse(
      db.prepare("SELECT body FROM documents WHERE kind='settings'").get().body,
    );
    settings.seasons = [
      {
        id: "summer",
        family_ids: [seed.families[0].id],
        product_ids: [],
        title: "Été propriétaire",
      },
    ];
    settings.phone = "0555112233";
    save("settings", settings);
    db.prepare(
      "INSERT OR REPLACE INTO meta VALUES('admin','owner-password-hash')",
    ).run();
    db.prepare(
      "INSERT INTO codes VALUES('client','Client','0770000000','private-pin-hash',1,7,'2026-10-01')",
    ).run();
    db.close();
    createLocalStore({ dataDir: directory, preserveExistingCatalog: false }).close();
    db = new DatabaseSync(path.join(directory, "store.sqlite"));
    const all = (kind) =>
      db
        .prepare("SELECT body FROM documents WHERE kind=?")
        .all(kind)
        .map((r) => JSON.parse(r.body));
    const families = all("family").sort((a, b) => a.sort_order - b.sort_order);
    assert.deepEqual(
      families.map((f) => f.name),
      [
        "Nouveaux produits",
        "Rangement & Boîtes",
        "Cuisine",
        "Chaises et Tables",
        "Salle de bain & Lavage",
        "Enfant",
        "pique-nique",
        "🌿 Jardin",
      ],
    );
    assert.equal(all("product").length, 350);
    assert.equal(
      families.find((f) => f.id === familyIds.rangement).slides[0].image,
      "/assets/owner-banner.png",
    );
    assert.equal(
      all("product").filter(
        (p) => !families.some((f) => f.id === p.family_id && f.kind !== "new"),
      ).length,
      0,
    );
    for (const p of all("product")) {
      const prior = products.find((x) => x.id === p.id);
      assert.deepEqual({ ...p, family_id: prior.family_id }, prior);
    }
    assert.deepEqual(all("order")[0], historic);
    assert.deepEqual(all("request")[0], historic);
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key='admin'").get().value,
      "owner-password-hash",
    );
    assert.equal(
      db.prepare("SELECT hash FROM codes WHERE id='client'").get().hash,
      "private-pin-hash",
    );
    assert.equal(all("settings")[0].phone, settings.phone);
    assert.equal(
      all("settings")[0].seasons[0].family_ids[0],
      familyIds.rangement,
    );
    const backup = all("family-backup")[0];
    assert.equal(backup.products.length, 350);
    assert.equal(backup.families.length, 17);
    const changed = {
      ...all("product")[0],
      family_id: familyIds.cuisine,
      is_new: true,
      new_until: "2027-01-01T00:00:00.000Z",
    };
    save("product", changed);
    db.close();
    createLocalStore({ dataDir: directory, preserveExistingCatalog: false }).close();
    db = new DatabaseSync(path.join(directory, "store.sqlite"));
    assert.deepEqual(
      JSON.parse(
        db
          .prepare("SELECT body FROM documents WHERE kind='product' AND id=?")
          .get(changed.id).body,
      ),
      changed,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM documents WHERE kind='family-backup'")
        .get().n,
      1,
    );
  } finally {
    if (db?.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("hidden legacy families and owner-created families remain private and retain their products", () => {
  const hidden = {
    ...seed.families.find((f) => f.name === "Boîtes Crystal"),
    visible: false,
  };
  const owner = {
    id: "owner-family",
    name: "Collection privée propriétaire",
    visible: false,
  };
  const owned = {
    ...seed.products[0],
    id: "owner-product",
    family_id: owner.id,
  };
  const next = planFamilyUpdate(
    [...seed.products, owned],
    [...seed.families.filter((f) => f.id !== hidden.id), hidden, owner],
    {},
  );
  for (const f of [hidden, owner]) {
    assert(next.families.some((x) => x.id === f.id && !x.visible));
    assert(next.products.filter((p) => p.family_id === f.id).length > 0);
  }
});
