import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/catalog.json" with { type: "json" };
import { productGroup } from "../src/productGroups.ts";

const group = (name: string, name_fr = "") => productGroup({ name, name_fr });

test("different product types reset the grouping key while all sizes share a heading", () => {
  assert.deepEqual(group("BASSINE 10 L"), group("Bassine — Ø 40 cm"));
  assert.deepEqual(
    group("BOITE CEREALES 04L"),
    group("Boîtes à céréales 1,8 L"),
  );
  assert.notEqual(group("BASSINE 10 L").key, group("BOITE CEREALES 04L").key);
  assert.notEqual(
    group("BOITE CEREALES 04L").key,
    group("BOITE CRYSTAL RC01").key,
  );
  assert.equal(
    group("BOITE CRYSTAL SERIE 03 MAXI REF RC 2+8+10").label,
    "Boîtes Crystal",
  );
});

test("renamed series, colours, model references and package quantities retain their group", () => {
  for (const [before, after] of [
    ["CONTENEUR CLIPSO 05L COULEUR", "CLIPSO 20L TRANSPARENT"],
    ["BOITE SAHLA SERIE 02 (750 + 1200 ML)", "SAHLA 1900 ML REF 03"],
    ["BOITE SPINNER CARRE 1480 ML", "SPINNER RONDE 2030 ML"],
    ["BOITE SWING SERIE 03 (350+600+980 ML)", "SWING S 03"],
    ["BOITE TOP CHEF 01.85L COULEUR", "TOP CHEF 32L TRANSPARENT"],
    ["BOITE CRYSTAL RC10 MAXI REF 02 DECOREE", "Boîte Crystal RC 22 — 80 L"],
    ["CORBEILLE A LINGE RONDE GM", "CORBELLE A LINGE RECT PM"],
    ["TABLE CHREA BLANCHE", "ABLE CHREA DECOREE"],
  ])
    assert.deepEqual(group(before), group(after), before + " / " + after);
  assert.notEqual(
    group("BOITE EMBALLAGE CARRE MAXI REF 2").key,
    group("BOITE EMBALLAGE RONDE 300ML REF 1").key,
  );
});

test("unknown types have a meaningful stable fallback without sizes or model codes", () => {
  assert.deepEqual(
    group("BAC RANGEMENT 10L REF AB12 COULEUR"),
    group("Bac rangement 25 L transparent"),
  );
  assert.deepEqual(group("Bac-rangement MAXI REF 02"), {
    key: "bac-rangement",
    label: "Bac rangement",
  });
  assert.deepEqual(
    group("  ", "Boîte à céréales 2 L"),
    group("BOITE CEREALES 4L"),
  );
  assert.deepEqual(group("", ""), { key: "produits", label: "Produits" });
});

test("catalogue grouping is total, deterministic and leaves catalogue order and records intact", () => {
  const before = JSON.stringify(seed.products);
  const keys = seed.products.map((p) => productGroup(p));
  assert.equal(keys.length, 350);
  for (const result of keys) {
    assert.ok(result.label.trim());
    assert.match(result.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.deepEqual(
    seed.products.map((p) => productGroup(p)),
    keys,
  );
  assert.equal(JSON.stringify(seed.products), before);
  assert.equal(keys.filter((g) => g.label === "Bassines").length, 8);
  assert.equal(keys.filter((g) => g.label === "Boîtes à céréales").length, 4);
  assert.equal(keys.filter((g) => g.label === "Boîtes Crystal").length, 28);
});
