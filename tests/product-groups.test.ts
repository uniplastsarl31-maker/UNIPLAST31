import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/data/catalog.json" with { type: "json" };
import {
  catalogueFamilyOrder,
  compareCatalogueProducts,
  productGroup,
} from "../src/productGroups.ts";
import updates from "../server/catalog-update.json" with { type: "json" };
import type { Family, Product } from "../src/types.ts";

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

const example = (code: string, name: string) =>
  ({ ...seed.products[0], code, name, name_fr: name }) as Product;

test("saved families keep configured order and references sort only inside them", () => {
  const families = [
    {
      ...seed.families[0],
      id: "children",
      name: "Enfant",
      kind: "standard",
      sort_order: 5,
    },
    {
      ...seed.families[0],
      id: "boxes",
      name: "Rangement & Boîtes",
      kind: "standard",
      sort_order: 1,
    },
    {
      ...seed.families[0],
      id: "kitchen",
      name: "Cuisine",
      kind: "standard",
      sort_order: 2,
    },
  ] as Family[];
  const list = [
    { ...example("BS2", "BOITE SANDWICH 100ML REF 2"), family_id: "children" },
    { ...example("BE4", "BOITE EMBALLAGE 100ML REF 4"), family_id: "boxes" },
    { ...example("BC", "BOITE CEREALES 1.2L"), family_id: "kitchen" },
    { ...example("BS1", "BOITE SANDWICH 900ML REF 1"), family_id: "children" },
    { ...example("BE1", "BOITE EMBALLAGE 900ML REF 1"), family_id: "boxes" },
  ];
  const before = JSON.stringify({ families, list });
  assert.deepEqual(
    [...list].sort(catalogueFamilyOrder(families)).map((p) => p.code),
    ["BE1", "BE4", "BC", "BS1", "BS2"],
  );
  assert.equal(JSON.stringify({ families, list }), before);
  families.find((f) => f.id === "children")!.sort_order = 0;
  assert.deepEqual(
    [...list].sort(catalogueFamilyOrder(families)).map((p) => p.code),
    ["BS1", "BS2", "BE1", "BE4", "BC"],
  );
});

test("new-product overlap never overrides the actual saved primary family", () => {
  const families = [
    {
      ...seed.families[0],
      id: "new",
      name: "Nouveaux produits",
      sort_order: 0,
      kind: "new",
    },
    {
      ...seed.families[0],
      id: "boxes",
      name: "Rangement & Boîtes",
      sort_order: 1,
      kind: "standard",
    },
    {
      ...seed.families[0],
      id: "children",
      name: "Enfant",
      sort_order: 5,
      kind: "standard",
    },
  ] as Family[];
  const children = families.find((f) => f.name === "Enfant")!;
  const boxes = families.find((f) => f.name === "Rangement & Boîtes")!;
  const sandwich = {
    ...example("BS", "BOITE SANDWICH REF 1"),
    family_id: children.id,
    is_new: true,
  };
  const box = {
    ...example("BE4", "BOITE EMBALLAGE REF 4"),
    family_id: boxes.id,
    is_new: false,
  };
  assert.deepEqual(
    [sandwich, box].sort(catalogueFamilyOrder(families)).map((p) => p.code),
    ["BE4", "BS"],
  );
  assert.equal(sandwich.family_id, children.id);
});

test("real catalogue family blocks stay contiguous without rewriting saved assignments", () => {
  const products = seed.products as Product[],
    families = seed.families as Family[];
  const before = JSON.stringify(products);
  const order = catalogueFamilyOrder(families);
  const sorted = [...products].reverse().sort(order);
  assert.deepEqual(
    sorted.map((p) => p.code),
    [...products].sort(order).map((p) => p.code),
  );
  const blocks = sorted
    .filter((p, i) => !i || p.family_id !== sorted[i - 1].family_id)
    .map((p) => p.family_id);
  assert.equal(new Set(blocks).size, blocks.length);
  const configured = [...families]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((f) => products.some((p) => p.family_id === f.id))
    .map((f) => f.id);
  assert.deepEqual(
    blocks.filter((id) => configured.includes(id)),
    configured,
  );
  assert.equal(JSON.stringify(products), before);
});

test("unknown families stay in deterministic blocks after configured families", () => {
  const family = {
    ...seed.families[0],
    id: "known",
    kind: "standard",
  } as Family;
  const list = [
    { ...example("Z2", "BOITE REF 2"), family_id: "unknown-z" },
    { ...example("A1", "BOITE REF 1"), family_id: "unknown-a" },
    { ...example("K", "BOITE REF 9"), family_id: "known" },
    { ...example("Z1", "BOITE REF 1"), family_id: "unknown-z" },
  ];
  assert.deepEqual(
    list.sort(catalogueFamilyOrder([family])).map((p) => p.code),
    ["K", "A1", "Z1", "Z2"],
  );
});

test("default catalogue order prioritizes references over capacity and package count", () => {
  const list = [
    example("R4", "BOITE EMBALLAGE CARRE MINI 1000ML REF 04"),
    example("R2", "BOITE EMBALLAGE CARRE MINI 450ML REF 02"),
    example("R10", "BOITE EMBALLAGE CARRE MINI S/2 (100ML) REF 10"),
    example("R3", "BOITE EMBALLAGE CARRE MINI S/4 (650ML) REF 03"),
    example("R1", "BOITE EMBALLAGE CARRE MINI S/4 (300ML) REF 01"),
  ];
  const before = JSON.stringify(list);
  assert.deepEqual(
    [...list].sort(compareCatalogueProducts).map((p) => p.code),
    ["R1", "R2", "R3", "R4", "R10"],
  );
  assert.equal(JSON.stringify(list), before);
});

test("all actual packaging shapes default to reference 1 before 2, 3 and 4", () => {
  const renamed = seed.products.map((p) => {
    const update = updates.products.find((u) => u.code === p.code);
    return { ...p, name: update?.name ?? p.name } as Product;
  });
  for (const shape of ["CARRE", "RECTANGLE", "RONDE"]) {
    const products = renamed.filter((p) =>
      p.name.startsWith("BOITE EMBALLAGE " + shape),
    );
    assert.ok(products.length > 4);
    const refs = products
      .sort(compareCatalogueProducts)
      .map((p) => Number(p.name.match(/\bREF\s*(\d+)/)?.[1]));
    assert.equal(refs[0], 1);
    assert.ok(
      refs.every((n, i) => Number.isFinite(n) && (!i || n >= refs[i - 1])),
      shape,
    );
  }
});

test("Crystal model number outranks its secondary REF and series sets follow individual models", () => {
  const list = [
    example("BCR10D", "BOITE CRYSTAL RC 10 MAXI REF 02 DECOREE"),
    example("BCRX3M", "BOITE CRYSTAL SERIE 03 MINI REF RC 4+6+9"),
    example("BCR03", "BOITE CRYSTAL RC03 250MLx2"),
    example("BCR01", "BOITE CRYSTAL RC01 MINI"),
    example("BCR22", "BOITE CRYSTAL RC22 80 L REF 09"),
    example("BCR02", "BOITE CRYSTAL RC02 MAXI"),
  ];
  assert.deepEqual(
    list.sort(compareCatalogueProducts).map((p) => p.code),
    ["BCR01", "BCR02", "BCR03", "BCR10D", "BCR22", "BCRX3M"],
  );
});

test("reference spelling variants and decimal sizes receive consistent numeric positions", () => {
  assert.deepEqual(
    [
      example("R10", "BOITE TEST 100ML RÉF. N°10"),
      example("R2", "BOITE TEST 900ML REFERENCE 02"),
      example("R1", "BOITE TEST 800ML REF01"),
    ]
      .sort(compareCatalogueProducts)
      .map((p) => p.code),
    ["R1", "R2", "R10"],
  );
  assert.deepEqual(
    [
      example("BC4L", "BOITE CEREALES 4L"),
      example("BC18L", "BOITE CEREALES 1,8 L"),
      example("BC12L", "BOITE CEREALES 1.2L"),
    ]
      .sort(compareCatalogueProducts)
      .map((p) => p.code),
    ["BC12L", "BC18L", "BC4L"],
  );
});

test("default catalogue ordering keeps each type contiguous and is independent of input order", () => {
  const products = seed.products as Product[];
  const before = JSON.stringify(products);
  const forward = [...products].sort(compareCatalogueProducts);
  const reversed = [...products].reverse().sort(compareCatalogueProducts);
  assert.deepEqual(
    forward.map((p) => p.code),
    reversed.map((p) => p.code),
  );
  const seen = new Set<string>();
  let previous = "";
  for (const product of forward) {
    const key = productGroup(product).key;
    if (key !== previous) {
      assert.equal(
        seen.has(key),
        false,
        key + " appeared in two separated blocks",
      );
      seen.add(key);
      previous = key;
    }
  }
  assert.equal(JSON.stringify(products), before);
});
