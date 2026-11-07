"use strict";
const weights = require("../data/weights-2026-11-07.json");
const { validateProduct } = require("./generated/domain.cjs");
const FIELDS = [
  "name",
  "barcode",
  "family_id",
  "description",
  "dimensions",
  "capacity",
  "material",
  "weight_grams",
  "pack_size",
  "pack_label",
  "unit_price_cents",
  "price_on_request",
  "available",
  "availability_confirmed",
  "stock_cartons",
  "is_new",
  "new_until",
  "upcoming",
  "preorder_enabled",
  "discount_price_cents",
  "discount_start",
  "discount_end",
  "offer_title",
  "show_offer",
  "pinned",
  "sort_order",
];
const norm = (v) => (v === undefined ? null : v);
const equal = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const codeOf = (c) =>
  String(c || "")
    .trim()
    .toUpperCase();

function createCatalogTransfer({
  all,
  get,
  put,
  meta,
  setMeta,
  remove,
  transaction,
  admin,
  assert,
  cleanText,
  hashSecret,
  verify,
  limit,
  uid,
  nowISO,
}) {
  const codeVersion = () => meta("transfer-code-version");
  const grantKey = (s) => "transfer-grant:" + s.token;
  const unlocked = (s) => {
    const g = JSON.parse(meta(grantKey(s)) || "null");
    return !!g && g.expires > Date.now() && g.version === codeVersion();
  };
  const requireCode = (s) =>
    assert(unlocked(s), "Saisissez de nouveau le code de mise à jour.", 403);
  function snapshot(s) {
    for (const old of all("transfer-export"))
      if (Date.parse(old.created_at) < Date.now() - 7 * 86400000)
        remove("transfer-export", old.id);
    const owned = all("transfer-export").filter((x) => x.owner === s.owner);
    for (const old of owned.slice(4)) remove("transfer-export", old.id);
    const value = {
      id: uid(),
      owner: s.owner,
      created_at: nowISO(),
      products: all("product"),
      families: all("family"),
    };
    put("transfer-export", value);
    return value;
  }
  function validateFinal(changes) {
    if (
      changes.every((c) => c.fields.every((f) => f.field === "weight_grams"))
    ) {
      for (const c of changes)
        for (const f of c.fields)
          assert(
            f.after == null ||
              (Number.isFinite(f.after) && f.after > 0 && f.after <= 10000000),
            "Poids invalide en grammes.",
          );
      return;
    }
    const patches = new Map(changes.map((x) => [x.id, x]));
    const products = all("product").map((p) => {
      const change = patches.get(p.id);
      const next = change
        ? {
            ...p,
            ...Object.fromEntries(change.fields.map((f) => [f.field, f.after])),
          }
        : p;
      if (change) {
        for (const field of ["name","description","dimensions","capacity","material","pack_label","offer_title"]) assert(typeof next[field] === "string", "Texte invalide : " + field);
        assert(next.barcode == null || typeof next.barcode === "string", "Code-barres invalide.");
        const error = validateProduct(next);
        assert(!error, error);
        assert(
          get("family", next.family_id)?.kind !== "new" &&
            get("family", next.family_id),
          "Choisissez une famille principale existante.",
        );
        assert(
          Number.isInteger(next.sort_order) &&
            Math.abs(next.sort_order) <= 1000000,
          "Ordre de produit invalide.",
        );
        for (const field of [
          "available",
          "availability_confirmed",
          "price_on_request",
          "is_new",
          "upcoming",
          "preorder_enabled",
          "show_offer",
          "pinned",
        ])
          assert(
            typeof next[field] === "boolean",
            "Valeur Oui / Non invalide.",
          );
        for (const [field, max] of [
          ["name", 150],
          ["description", 10000],
          ["dimensions", 200],
          ["material", 200],
          ["capacity", 100],
          ["pack_label", 30],
          ["offer_title", 200],
        ])
          cleanText(
            next[field] || "",
            max,
            field === "name" || field === "pack_label" ? 1 : 0,
          );
        for (const field of ["new_until", "discount_start", "discount_end"])
          assert(
            next[field] == null ||
              (typeof next[field] === "string" &&
                Number.isFinite(Date.parse(next[field]))),
            "Date invalide.",
          );
      }
      return next;
    });
    for (const key of ["code", "barcode"]) {
      const used = new Set();
      for (const p of products)
        if (p[key]) {
          const value = codeOf(p[key]);
          assert(
            !used.has(value),
            "Référence ou code-barres dupliqué : " + value,
          );
          used.add(value);
        }
    }
  }
  function plan(s, base, rows, mode, source) {
    assert(["weights", "all"].includes(mode), "Mode de mise à jour invalide.");
    assert(
      Array.isArray(rows) && rows.length <= 5000,
      "5000 lignes au maximum.",
    );
    const baseline = new Map(base.products.map((p) => [p.id, p])),
      changes = [],
      skipped = [],
      conflicts = [],
      seen = new Set();
    for (const row of rows) {
      assert(
        row &&
          typeof row.id === "string" &&
          typeof row.code === "string" &&
          row.values &&
          typeof row.values === "object" &&
          !Array.isArray(row.values),
        "Ligne de mise à jour invalide.",
      );
      assert(!seen.has(row.id), "Produit répété dans le fichier : " + row.code);
      seen.add(row.id);
      const original = baseline.get(row.id),
        current = get("product", row.id);
      if (
        !original ||
        !current ||
        codeOf(original.code) !== codeOf(row.code) ||
        codeOf(current.code) !== codeOf(original.code)
      ) {
        skipped.push({
          code: row.code,
          reason: "Produit absent ou référence modifiée.",
        });
        continue;
      }
      const fields = [];
      for (const field of Object.keys(row.values)) {
        assert(FIELDS.includes(field), "Colonne non modifiable : " + field);
        if (mode === "weights" && field !== "weight_grams") continue;
        const before = norm(original[field]),
          after = norm(row.values[field]);
        if (equal(before, after) || equal(current[field], after)) continue;
        if (!equal(current[field], before)) {
          conflicts.push({ code: row.code, field });
          continue;
        }
        fields.push({ field, before, after });
      }
      if (fields.length)
        changes.push({
          id: current.id,
          code: current.code,
          name: current.name,
          fields,
        });
    }
    if (!conflicts.length) validateFinal(changes);
    const value = {
      id: uid(),
      owner: s.owner,
      created_at: nowISO(),
      source,
      mode,
      changes,
      skipped,
      conflicts,
      count: changes.length,
    };
    put("transfer-plan", value);
    return { ...value, plan_id: value.id };
  }
  return async function handle(name, p, s, address) {
    if (!name.startsWith("transfer-")) return { handled: false };
    admin(s);
    if (name === "transfer-status")
      return {
        handled: true,
        result: {
          configured: !!meta("transfer-code-hash"),
          unlocked: unlocked(s),
        },
      };
    if (name === "transfer-code" || name === "transfer-unlock") {
      const throttle = limit(["transfer-code:" + s.owner], 5, 900000);
      const stored = meta("transfer-code-hash");
      if (name === "transfer-code") {
        const next = cleanText(p?.next, 128, 8);
        assert(!/\s/.test(next), "Le code ne doit pas contenir d’espaces.");
        if (stored) {
          throttle.fail();
          assert(
            typeof p.current === "string" &&
              p.current.length <= 128 &&
              (await verify(p.current, stored)),
            "Code actuel incorrect.",
            403,
          );
        }
        setMeta("transfer-code-hash", await hashSecret(next));
        setMeta("transfer-code-version", uid());
        throttle.clear();
      } else {
        assert(stored, "Définissez votre code de mise à jour dans cet espace.");
        throttle.fail();
        assert(
          typeof p?.code === "string" &&
            p.code.length <= 128 &&
            (await verify(p.code, stored)),
          "Code de mise à jour incorrect.",
          403,
        );
        throttle.clear();
      }
      setMeta(
        grantKey(s),
        JSON.stringify({
          expires: Date.now() + 15 * 60000,
          version: codeVersion(),
        }),
      );
      return { handled: true, result: { configured: true, unlocked: true } };
    }
    requireCode(s);
    if (name === "transfer-export") {
      const x = snapshot(s);
      return {
        handled: true,
        result: {
          export_id: x.id,
          created_at: x.created_at,
          products: x.products,
          families: x.families,
        },
      };
    }
    if (name === "transfer-preview") {
      const base = get("transfer-export", p.export_id);
      assert(
        base &&
          base.owner === s.owner &&
          Date.parse(base.created_at) > Date.now() - 7 * 86400000,
        "L’export a expiré. Téléchargez un nouvel Excel.",
      );
      return { handled: true, result: plan(s, base, p.rows, p.mode, "Excel") };
    }
    if (name === "transfer-weights-preview") {
      const base = snapshot(s),
        codes = new Map(),
        skipped = [];
      for (const product of base.products) {
        const code = codeOf(product.code);
        if (!codes.has(code)) codes.set(code, []);
        codes.get(code).push(product);
      }
      const rows = [];
      for (const source of weights.source_rows) {
        const candidates = codes.get(codeOf(source.code));
        if (!candidates?.length) {
          skipped.push({
            code: source.code,
            reason: "Absent du catalogue actuel.",
          });
          continue;
        }
        if (candidates.length !== 1) {
          skipped.push({ code: source.code, reason: "Référence ambiguë." });
          continue;
        }
        const weight =
          source.pdf_weight_grams > 0
            ? source.pdf_weight_grams
            : source.excel_weight_grams;
        if (!(weight > 0 && Number.isFinite(weight))) {
          skipped.push({
            code: source.code,
            reason: "Aucun poids renseigné : fiche inchangée.",
          });
          continue;
        }
        rows.push({
          id: candidates[0].id,
          code: candidates[0].code,
          values: { weight_grams: weight },
        });
      }
      const result = plan(
        s,
        base,
        rows,
        "weights",
        "PDF / Excel du 07-11-2026",
      );
      result.skipped.push(...skipped);
      put("transfer-plan", result);
      return { handled: true, result };
    }
    if (name === "transfer-apply")
      return {
        handled: true,
        result: transaction(() => {
          const x = get("transfer-plan", p.plan_id);
          assert(x && x.owner === s.owner, "Préparation introuvable.");
          if (x.applied) return x.applied;
          assert(
            Date.parse(x.created_at) > Date.now() - 30 * 60000,
            "La préparation a expiré. Préparez à nouveau l’import.",
          );
          assert(
            !x.conflicts.length,
            "Des données ont changé : exportez un nouveau fichier et recommencez.",
          );
          for (const change of x.changes) {
            const current = get("product", change.id);
            assert(
              current &&
                current.code === change.code &&
                change.fields.every((f) => equal(current[f.field], f.before)),
              "Un produit a été modifié après la préparation : " + change.code,
            );
          }
          validateFinal(x.changes);
          const backup = {
            id: uid(),
            owner: s.owner,
            created_at: nowISO(),
            source: x.source,
            changes: x.changes,
          };
          put("product-update-backup", backup);
          for (const change of x.changes) {
            const current = get("product", change.id);
            put("product", {
              ...current,
              ...Object.fromEntries(
                change.fields.map((f) => [f.field, f.after]),
              ),
            });
          }
          const result = { updated: x.changes.length, backup_id: backup.id };
          put("transfer-plan", { ...x, applied: result });
          return result;
        }),
      };
    if (name === "transfer-backup") {
      const backup = get(
        "product-update-backup",
        address.searchParams.get("id"),
      );
      assert(backup && backup.owner === s.owner, "Sauvegarde introuvable.");
      return { handled: true, result: backup };
    }
    if (name === "transfer-restore")
      return {
        handled: true,
        result: transaction(() => {
          const backup = get("product-update-backup", p.backup_id);
          assert(backup && backup.owner === s.owner, "Sauvegarde introuvable.");
          if (backup.restored_at) return { restored: 0 };
          for (const change of backup.changes) {
            const current = get("product", change.id);
            assert(
              current &&
                current.code === change.code &&
                change.fields.every((f) => equal(current[f.field], f.after)),
              "Le produit a changé depuis l’import : " + change.code,
            );
          }
          const reverted = backup.changes.map((c) => ({
            ...c,
            fields: c.fields.map((f) => ({
              field: f.field,
              before: f.after,
              after: f.before,
            })),
          }));
          validateFinal(reverted);
          for (const change of reverted)
            put("product", {
              ...get("product", change.id),
              ...Object.fromEntries(
                change.fields.map((f) => [f.field, f.after]),
              ),
            });
          put("product-update-backup", { ...backup, restored_at: nowISO() });
          return { restored: reverted.length };
        }),
      };
    assert(false, "Opération de mise à jour inconnue.");
  };
}
module.exports = { createCatalogTransfer };
