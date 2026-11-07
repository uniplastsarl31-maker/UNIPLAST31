import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import localStore from "../local-store.cjs";
import weightFill from "../weight-fill.cjs";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";
import seed from "../generated/seed.json" with { type: "json" };

test("an old Netlify snapshot fills blank weights durably through CAS retry without resetting owner photos, prices or history", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "uniplast-weight-cold-"),
  );
  let db;
  try {
    const family = {
      ...seed.families[0],
      id: randomUUID(),
      name: "Famille du propriétaire",
    };
    const photoId = randomUUID(),
      photoUrl = "/api/local/file?id=" + photoId;
    const sample = (code) => ({
      ...seed.products[0],
      id: randomUUID(),
      code,
      family_id: family.id,
      name: "NOM PERSONNALISÉ " + code,
      name_fr: "NOM PERSONNALISÉ " + code,
      unit_price_cents: 76543,
      weight_grams: null,
      available: true,
      availability_confirmed: true,
      images: [{ url: photoUrl, scale: 1.15, x: 2, y: -3 }],
    });
    const automatic = sample("BCR12"),
      manual = { ...sample("B10L"), weight_grams: 999.9 },
      missing = sample("C2AC");
    localStore
      .createLocalStore({
        dataDir: directory,
        seedData: {
          families: [family],
          products: [automatic, manual, missing],
        },
      })
      .close();
    const file = path.join(directory, "store.sqlite");
    db = new DatabaseSync(file);
    db.prepare("DELETE FROM meta WHERE key=?").run(weightFill.weightFillKey);
    db.prepare(
      "INSERT OR REPLACE INTO meta VALUES('admin','owner-admin-hash')",
    ).run();
    db.prepare("INSERT INTO documents VALUES('order','owner-history',?)").run(
      JSON.stringify({
        id: "owner-history",
        status: "new",
        customer: { name: "Client du propriétaire" },
        items: [],
        total_cents: 12345,
      }),
    );
    db.prepare("INSERT INTO uploads VALUES(?,?,?,1)").run(
      photoId,
      "image/png",
      "admin",
    );
    const before = db
      .prepare("SELECT kind,id,body FROM documents ORDER BY kind,id")
      .all();
    db.close();
    db = null;
    const stores = memoryStores(),
      png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    await stores.state.set("store.sqlite", new Blob([fs.readFileSync(file)]), {
      onlyIfNew: true,
    });
    await stores.files.set(photoId, new Blob([png]), { onlyIfNew: true });
    stores.state.rejectWrites = 1;
    const SITE = "https://weight-cold-test.example";
    const call = (route) =>
      createNetlifyHandler({
        getStores: () => stores,
        origins: [SITE],
        setupKey: "TEST-ONLY-weight-cold-install-key",
      })(new Request(SITE + "/api/local/" + route), { ip: "192.0.2.51" });
    const first = await call("catalog");
    assert.equal(first.status, 200);
    assert.equal(
      (await first.json()).products.find((p) => p.id === automatic.id)
        .weight_grams,
      260,
    );
    assert(stores.state.conflicts >= 1);
    const writes = stores.state.writes,
      second = await call("catalog");
    assert.equal(
      (await second.json()).products.find((p) => p.id === manual.id)
        .weight_grams,
      999.9,
    );
    assert.equal(stores.state.writes, writes);
    const image = await call("file?id=" + photoId);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    assert.equal(image.headers.get("cache-control"), "public, max-age=3600");
    const saved = await stores.state.getWithMetadata("store.sqlite");
    const inspectedFile = path.join(directory, "inspected.sqlite");
    fs.writeFileSync(inspectedFile, Buffer.from(saved.data));
    db = new DatabaseSync(inspectedFile);
    for (const row of before) {
      const actual = JSON.parse(
          db
            .prepare("SELECT body FROM documents WHERE kind=? AND id=?")
            .get(row.kind, row.id).body,
        ),
        expected = JSON.parse(row.body);
      if (row.kind === "product" && row.id === automatic.id)
        expected.weight_grams = 260;
      assert.equal(JSON.stringify(actual), JSON.stringify(expected));
    }
    assert.equal(
      db.prepare("SELECT count(*) n FROM documents WHERE kind='product'").get()
        .n,
      3,
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM documents WHERE kind='weight-fill-backup'",
        )
        .get().n,
      1,
    );
    const summary = JSON.parse(
      db
        .prepare("SELECT value FROM meta WHERE key=?")
        .get(weightFill.weightFillKey).value,
    );
    assert.equal(summary.filled, 1);
    assert.equal(summary.existing_weight, 1);
    assert.equal(summary.missing_in_source, 1);
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key='admin'").get().value,
      "owner-admin-hash",
    );
    assert.equal(db.prepare("SELECT id FROM uploads").get().id, photoId);
  } finally {
    if (db?.isOpen) db.close();
    if (
      path.dirname(directory) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith("uniplast-weight-cold-")
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});
