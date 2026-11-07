import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";

const SITE = "https://catalog-transfer-test.example";
const INSTALL = "TEST-ONLY-catalog-transfer-installation-key";
const PASSWORD = "TEST-ONLY-catalog-transfer-admin!";
const CODE = "TEST-ONLY-update-code!";
const NEXT_CODE = "TEST-ONLY-changed-update-code!";

function fixture() {
  const stores = memoryStores();
  const cookies = {};
  const config = {
    getStores: () => stores,
    origins: [SITE],
    setupKey: INSTALL,
  };
  async function call(name, data, who = "admin", extra = {}) {
    const path = name.startsWith("/") ? name : "/api/local/" + name;
    const response = await createNetlifyHandler(config)(
      new Request(SITE + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined ? {} : { "content-type": "application/json" }),
          ...(cookies[who] ? { cookie: cookies[who] } : {}),
          ...extra.headers,
        },
        body:
          data === undefined
            ? undefined
            : extra.binary
              ? data
              : JSON.stringify(data),
      }),
      { ip: "192.0.2.77", requestId: "catalog-transfer-test" },
    );
    const cookie = response.headers.get("set-cookie");
    if (cookie) cookies[who] = cookie.split(";")[0];
    return {
      status: response.status,
      data: response.headers.get("content-type")?.startsWith("application/json")
        ? await response.json()
        : await response.text(),
    };
  }
  async function setup(unlock = true) {
    assert.equal(
      (await call("setup", { setup_key: INSTALL, password: PASSWORD })).status,
      200,
    );
    if (unlock) {
      assert.equal((await call("transfer-code", { next: CODE })).status, 200);
      assert.equal((await call("transfer-unlock", { code: CODE })).status, 200);
    }
    return (await call("catalog")).data;
  }
  return { stores, cookies, call, setup };
}

const withoutWeight = (product) => {
  const { weight_grams, ...rest } = product;
  return rest;
};
const productRows = (products) =>
  [...products].sort((a, b) => a.id.localeCompare(b.id));

test("catalogue transfers require an administrator plus a separate session-bound code; rotation revokes grants", async () => {
  const f = fixture();
  await f.setup(false);
  assert.equal((await f.call("transfer-status")).data.configured, false);
  assert.notEqual((await f.call("transfer-export", {})).status, 200);
  assert.equal(
    (await f.call("transfer-status", undefined, "visitor")).status,
    403,
  );
  assert.equal(
    (await f.call("transfer-code", { next: CODE }, "visitor")).status,
    403,
  );
  assert.equal(
    (await f.call("transfer-unlock", { code: CODE }, "visitor")).status,
    403,
  );
  assert.equal((await f.call("transfer-code", { next: CODE })).status, 200);
  assert.equal((await f.call("transfer-status")).data.configured, true);
  assert.notEqual(
    (await f.call("transfer-unlock", { code: "TEST-ONLY-wrong-code" })).status,
    200,
  );
  assert.equal((await f.call("transfer-unlock", { code: CODE })).status, 200);
  const exported = await f.call("transfer-export", {});
  assert.equal(exported.status, 200);
  assert(exported.data.export_id);
  assert.equal(exported.data.products.length, 350);
  const publicCatalogue = (await f.call("catalog", undefined, "visitor")).data;
  assert.equal(JSON.stringify(publicCatalogue.settings).includes(CODE), false);
  assert.equal(
    JSON.stringify(publicCatalogue.settings).includes(NEXT_CODE),
    false,
  );
  assert.equal(
    (await f.call("admin-login", { password: PASSWORD }, "otherAdmin")).status,
    200,
  );
  assert.notEqual(
    (await f.call("transfer-export", {}, "otherAdmin")).status,
    200,
    "another admin session must enter the update code itself",
  );
  assert.equal(
    (await f.call("transfer-unlock", { code: CODE }, "otherAdmin")).status,
    200,
  );
  assert.equal((await f.call("transfer-export", {}, "otherAdmin")).status, 200);
  assert.equal(
    (await f.call("transfer-code", { current: CODE, next: NEXT_CODE })).status,
    200,
  );
  assert.notEqual(
    (await f.call("transfer-export", {}, "otherAdmin")).status,
    200,
    "rotating the code must invalidate another session’s existing grant",
  );
  assert.notEqual(
    (await f.call("transfer-unlock", { code: CODE }, "otherAdmin")).status,
    200,
  );
  assert.equal(
    (await f.call("transfer-unlock", { code: NEXT_CODE }, "otherAdmin")).status,
    200,
  );
  assert.equal((await f.call("transfer-export", {}, "otherAdmin")).status, 200);
});

test("weight import preserves live photos, names, prices and fields changed after export; backup restore only touches imported fields", async () => {
  const f = fixture();
  const catalogue = await f.setup();
  const original = catalogue.products.find((p) => p.code === "B10L");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  const upload = await f.call("upload?public=1", png, "admin", {
    binary: true,
    headers: { "content-type": "image/png" },
  });
  assert.equal(upload.status, 200);
  const edited = {
    ...original,
    name: "Nom actuel ajouté par le propriétaire",
    name_fr: "Nom actuel ajouté par le propriétaire",
    unit_price_cents: 12345,
    price_on_request: false,
    discount_price_cents: null,
    weight_grams: 11,
    images: [
      { url: upload.data, original_url: upload.data, scale: 1.2, x: 6, y: -3 },
    ],
  };
  assert.equal((await f.call("product-save", edited)).status, 200);
  const exported = (await f.call("transfer-export", {})).data;
  const preview = await f.call("transfer-preview", {
    export_id: exported.export_id,
    mode: "weights",
    rows: [
      { id: edited.id, code: edited.code, values: { weight_grams: 123 } },
      {
        id: randomUUID(),
        code: "ABSENT-TEST-REFERENCE",
        values: { weight_grams: 999 },
      },
    ],
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.count, 1);
  assert.equal(preview.data.skipped.length, 1);
  assert.equal(preview.data.conflicts.length, 0);
  const live = {
    ...edited,
    name: "Nom modifié après l’export Excel",
    name_fr: "Nom modifié après l’export Excel",
    unit_price_cents: 9876,
    material: "Matière renseignée entre-temps",
  };
  assert.equal((await f.call("product-save", live)).status, 200);
  const applied = await f.call("transfer-apply", {
    plan_id: preview.data.plan_id,
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.updated, 1);
  assert(applied.data.backup_id);
  const after = (await f.call("catalog")).data.products.find(
    (p) => p.id === edited.id,
  );
  assert.equal(after.weight_grams, 123);
  assert.deepEqual(withoutWeight(after), withoutWeight(live));
  assert.equal((await f.call(upload.data, undefined, "visitor")).status, 200);
  const repeat = await f.call("transfer-apply", {
    plan_id: preview.data.plan_id,
  });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.backup_id, applied.data.backup_id);
  assert.equal(
    (await f.call("catalog")).data.products.find((p) => p.id === edited.id)
      .weight_grams,
    123,
  );
  const backup = await f.call(
    "transfer-backup?id=" + encodeURIComponent(applied.data.backup_id),
  );
  assert.equal(backup.status, 200);
  assert.notEqual(
    (
      await f.call(
        "transfer-backup?id=" + encodeURIComponent(applied.data.backup_id),
        undefined,
        "visitor",
      )
    ).status,
    200,
  );
  const afterImportEdit = {
    ...after,
    name: "Nom conservé lors de la restauration",
    name_fr: "Nom conservé lors de la restauration",
  };
  assert.equal((await f.call("product-save", afterImportEdit)).status, 200);
  const restored = await f.call("transfer-restore", {
    backup_id: applied.data.backup_id,
  });
  assert.equal(restored.status, 200);
  const restoredProduct = (await f.call("catalog")).data.products.find(
    (p) => p.id === edited.id,
  );
  assert.equal(restoredProduct.weight_grams, 11);
  assert.deepEqual(
    withoutWeight(restoredProduct),
    withoutWeight(afterImportEdit),
  );
});

test("imports detect edited baseline fields and refuse atomic apply if a target changes after preview", async () => {
  const f = fixture();
  const c = await f.setup();
  const a = { ...c.products.find((p) => p.code === "B10L"), weight_grams: 11 };
  const b = { ...c.products.find((p) => p.code === "B25L"), weight_grams: 12 };
  assert.equal((await f.call("product-save", a)).status, 200);
  assert.equal((await f.call("product-save", b)).status, 200);
  const baseline = (await f.call("transfer-export", {})).data;
  assert.equal(
    (await f.call("product-save", { ...a, weight_grams: 22 })).status,
    200,
  );
  const stale = await f.call("transfer-preview", {
    export_id: baseline.export_id,
    mode: "weights",
    rows: [{ id: a.id, code: a.code, values: { weight_grams: 33 } }],
  });
  assert.equal(stale.status, 200);
  assert(
    stale.data.conflicts.length > 0,
    "changes to a field since export must be visible before import",
  );
  if (stale.data.plan_id)
    assert.notEqual(
      (await f.call("transfer-apply", { plan_id: stale.data.plan_id })).status,
      200,
    );
  assert.equal(
    (await f.call("catalog")).data.products.find((p) => p.id === a.id)
      .weight_grams,
    22,
  );
  const fresh = (await f.call("transfer-export", {})).data;
  const plan = await f.call("transfer-preview", {
    export_id: fresh.export_id,
    mode: "weights",
    rows: [
      { id: a.id, code: a.code, values: { weight_grams: 33 } },
      { id: b.id, code: b.code, values: { weight_grams: 66 } },
    ],
  });
  assert.equal(plan.status, 200);
  assert.equal(plan.data.count, 2);
  assert.equal(
    (await f.call("product-save", { ...a, weight_grams: 44 })).status,
    200,
  );
  assert.notEqual(
    (await f.call("transfer-apply", { plan_id: plan.data.plan_id })).status,
    200,
  );
  const after = (await f.call("catalog")).data;
  assert.equal(after.products.find((p) => p.id === a.id).weight_grams, 44);
  assert.equal(
    after.products.find((p) => p.id === b.id).weight_grams,
    12,
    "a conflict must prevent every other update in the batch",
  );
});

test("the supplied catalogue updates only 303 matched weights using PDF priority and leaves missing weights and all other data intact", async () => {
  const f = fixture();
  const c = await f.setup();
  const noSourceWeight = c.products.find((p) => p.code === "P4985");
  assert.equal(
    (await f.call("product-save", { ...noSourceWeight, weight_grams: 99 }))
      .status,
    200,
  );
  const before = (await f.call("catalog")).data;
  const preview = await f.call("transfer-weights-preview", {});
  assert.equal(preview.status, 200);
  assert.equal(preview.data.count, 303);
  const applied = await f.call("transfer-apply", {
    plan_id: preview.data.plan_id,
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.updated, 303);
  const after = (await f.call("catalog")).data;
  assert.equal(after.products.length, before.products.length);
  for (const [code, weight] of [
    ["BCR12", 260],
    ["BCR19", 910],
    ["BCR22", 2459],
    ["BCR22CL", 2391],
  ])
    assert.equal(
      after.products.find((p) => p.code === code).weight_grams,
      weight,
    );
  assert.equal(
    after.products.find((p) => p.code === "P4985").weight_grams,
    99,
    "a blank source must not erase an owner-entered value",
  );
  assert.deepEqual(
    productRows(after.products).map(withoutWeight),
    productRows(before.products).map(withoutWeight),
  );
  assert.deepEqual(after.settings, before.settings);
  assert.deepEqual(after.families, before.families);
});

test("live owner-added references receive Excel fallback weights; all-fields imports remain selective and restore refuses newer edits", async () => {
  const f = fixture();
  const c = await f.setup();
  const example = c.products.find((p) => p.code === "B10L");
  const ownerProduct = {
    ...example,
    id: randomUUID(),
    code: "FO5LTC",
    barcode: null,
    name: "Produit ajouté depuis la publication",
    name_fr: "Produit ajouté depuis la publication",
    weight_grams: 23,
    discount_price_cents: null,
    images: [{ url: "/assets/owner-photo.webp", scale: 1.3, x: 3, y: -4 }],
  };
  assert.equal((await f.call("product-save", ownerProduct)).status, 200);
  const weights = await f.call("transfer-weights-preview", {});
  assert.equal(weights.status, 200);
  assert.equal(
    weights.data.count,
    304,
    "matching must use the live catalogue, including owner-created references",
  );
  assert.equal(
    (await f.call("transfer-apply", { plan_id: weights.data.plan_id })).status,
    200,
  );
  const weighted = (await f.call("catalog")).data.products.find(
    (p) => p.id === ownerProduct.id,
  );
  assert.equal(
    weighted.weight_grams,
    271.5,
    "FO5LTC has no PDF weight and must fall back to Excel",
  );
  assert.deepEqual(withoutWeight(weighted), withoutWeight(ownerProduct));
  const exported = (await f.call("transfer-export", {})).data;
  const readonlyPhoto = await f.call("transfer-preview", {
    export_id: exported.export_id,
    mode: "all",
    rows: [{ id: weighted.id, code: weighted.code, values: { images: [] } }],
  });
  assert.notEqual(
    readonlyPhoto.status,
    200,
    "Excel imports cannot replace photo metadata",
  );
  const preview = await f.call("transfer-preview", {
    export_id: exported.export_id,
    mode: "all",
    rows: [
      {
        id: weighted.id,
        code: weighted.code,
        values: {
          name: "Nom actualisé depuis Excel",
          unit_price_cents: 22222,
          dimensions: "15 × 12 cm",
          material: "Matière test",
        },
      },
    ],
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.count, 1);
  const applied = await f.call("transfer-apply", {
    plan_id: preview.data.plan_id,
  });
  assert.equal(applied.status, 200);
  const imported = (await f.call("catalog")).data.products.find(
    (p) => p.id === ownerProduct.id,
  );
  assert.equal(imported.name, "Nom actualisé depuis Excel");
  assert.equal(imported.unit_price_cents, 22222);
  assert.equal(imported.dimensions, "15 × 12 cm");
  assert.equal(imported.weight_grams, 271.5);
  assert.deepEqual(imported.images, ownerProduct.images);
  assert.equal(
    (await f.call("product-save", { ...imported, unit_price_cents: 33333 }))
      .status,
    200,
  );
  assert.notEqual(
    (await f.call("transfer-restore", { backup_id: applied.data.backup_id }))
      .status,
    200,
    "restore must not overwrite a more recent edit to an imported field",
  );
  const preserved = (await f.call("catalog")).data.products.find(
    (p) => p.id === ownerProduct.id,
  );
  assert.equal(preserved.unit_price_cents, 33333);
  assert.equal(
    preserved.name,
    imported.name,
    "failed restore must remain atomic",
  );
});

test("price comparison requires unlocked admin, reports live edits and never overwrites a price", async () => {
  const f = fixture();
  const catalog = await f.setup(false);
  assert.notEqual((await f.call("transfer-price-review", {})).status, 200);
  assert.notEqual((await f.call("transfer-price-review", {}, "visitor")).status, 200);
  await f.call("transfer-code", { next: CODE });
  await f.call("transfer-unlock", { code: CODE });
  const p = catalog.products.find(p => p.code === "BER300ML");
  const edited = {...p, unit_price_cents: 1678, price_on_request:false};
  assert.equal((await f.call("product-save", edited)).status, 200);
  const audit = await f.call("transfer-price-review", {});
  assert.equal(audit.status, 200);
  const row = audit.data.find(r => r.code === p.code);
  assert.equal(row.status, "À vérifier");
  assert.equal(row.current, 1678);
  assert.equal(row.expected, 1500);
  assert.equal((await f.call("catalog")).data.products.find(i => i.id === p.id).unit_price_cents,1678);
});
