"use strict";
const version = "2026-11-02-families-v1";
const ids = {
  news: "1d682d73-28fe-5589-94b6-a6923cad6f80",
  rangement: "b84d4e2e-1391-58a7-9633-e4cc051ce432",
  cuisine: "61d62010-e4f9-5a7c-91d6-4e93c2ef025e",
  mobilier: "8f173c15-3bc9-549f-ae05-4e6e9290b548",
  lavage: "5ed6787f-c1d6-5169-850a-1d48f7216615",
  enfant: "9fd27cbd-2dc3-5606-8433-8521b141b35a",
  pique: "77a24df3-4d42-5931-9473-5cd38644d8dc",
  jardin: "086685d6-5fea-5c62-9364-bbda406f4139",
};
const mapping = {
  "11b5812f-d223-5e72-b17a-8307970081e4": ids.rangement,
  "c032e696-501e-57b1-a2d0-cd5acb598315": ids.rangement,
  [ids.rangement]: ids.rangement,
  "f2ccca2a-43c6-580e-9f47-4aec76842673": ids.cuisine,
  [ids.pique]: ids.pique,
  [ids.lavage]: ids.lavage,
  "84b94da7-e787-50b7-9e16-1285428b6b7d": ids.rangement,
  "d80d05f5-1efb-53e8-9c8b-f941802c4b94": ids.rangement,
  "5aeebab9-7d33-5538-ac95-829e0e58089f": ids.lavage,
  "84442a77-9896-5e0c-b352-23fad7f8f76f": ids.rangement,
  [ids.cuisine]: ids.cuisine,
  "ee8e8a37-e692-5472-b146-015b7019ae89": ids.cuisine,
  [ids.mobilier]: ids.mobilier,
  "a59f1420-0f04-58f6-8924-239f93baad84": ids.lavage,
  "cf9ed688-66c1-5ecc-b16e-73ff98660944": ids.pique,
  [ids.jardin]: ids.jardin,
  "8291c119-ad72-544c-bbe3-625eabaa02b3": ids.rangement,
};
const definitions = [
  [
    ids.news,
    "Nouveaux produits",
    "",
    "Découvrez les nouveautés UNIPLAST, réunies ici dès leur mise en avant.",
    "new",
  ],
  [
    ids.rangement,
    "Rangement & Boîtes",
    "/assets/square-tall.webp",
    "Boîtes, paniers et solutions de rangement : trouvez le format qui vous convient.",
  ],
  [
    ids.cuisine,
    "Cuisine",
    "/assets/spinner-color.webp",
    "Préparer, conserver et servir. Explorez les articles UNIPLAST pour la cuisine.",
  ],
  [
    ids.mobilier,
    "Chaises et Tables",
    "/assets/royal-chair.webp",
    "Chaises, tables et tabourets : choisissez vos références et leurs différents formats.",
  ],
  [
    ids.lavage,
    "Salle de bain & Lavage",
    "/assets/basin-10.webp",
    "Des articles pratiques pour le linge, la salle de bain et l’entretien de la maison.",
  ],
  [
    ids.enfant,
    "Enfant",
    "",
    "Retrouvez les articles du catalogue destinés aux enfants.",
  ],
  [
    ids.pique,
    "pique-nique",
    "/assets/lunchbox.webp",
    "Préparez vos repas à emporter et vos sorties avec notre sélection pique-nique.",
  ],
  [
    ids.jardin,
    "🌿 Jardin",
    "",
    "Pots et accessoires pour aménager vos espaces et accueillir vos plantes.",
  ],
];
// Pure plan shared by the persistent migration and the public build. Never changes prices or images.
function planFamilyUpdate(products, families, settings) {
  const existing = new Map(families.map((f) => [f.id, f]));
  const destinations = new Set(definitions.map((d) => d[0]));
  // Owner-created collections and deliberately hidden collections retain their own products.
  const retained = families.filter(
    (f) =>
      (!mapping[f.id] && !destinations.has(f.id)) ||
      (!f.visible && !destinations.has(f.id)),
  );
  const retainedIds = new Set(retained.map((f) => f.id));
  const mapId = (id) => (retainedIds.has(id) ? id : mapping[id] || id);
  const slides = (rows) =>
    rows?.map((h) => ({ ...h, family_id: mapId(h.family_id) }));
  const nextFamilies = definitions.map(
    ([id, name, image, introduction, kind], i) => {
      const prior = existing.get(id);
      const inherit = (key) => {
        if (prior?.[key] !== undefined) return slides(prior[key]);
        const rows = families
          .filter((f) => mapId(f.id) === id)
          .flatMap((f) => f[key] || []);
        return rows.length ? slides(rows.slice(0, 12)) : undefined;
      };
      return {
        ...(prior || {}),
        id,
        name,
        name_fr: name,
        image: prior?.image || image,
        visible: prior?.visible ?? true,
        sort_order: i,
        kind: kind || "standard",
        introduction: prior?.introduction ?? introduction,
        aliases: [
          ...new Set([
            ...(prior?.aliases || []),
            ...Object.keys(mapping).filter((k) => k !== id && mapId(k) === id),
          ]),
        ],
        slides: inherit("slides"),
        promotions: inherit("promotions"),
      };
    },
  );
  const nextProducts = products.map((p) => {
    if (!mapping[p.family_id] || retainedIds.has(p.family_id)) return p;
    let family_id = mapId(p.family_id);
    if (/\bENFANTS?\b|\bMICKEY\b/i.test(p.name)) family_id = ids.enfant;
    else if (
      /\bLINGE\b|\bPINCE\b|^SEAUX?\b/i.test(p.name) ||
      ["BYBLOS", "BYC"].includes(p.code)
    )
      family_id = ids.lavage;
    else if (
      [
        "RC",
        "RMFAI",
        "RMFDI",
        "RMFSI",
        "PCO GM",
        "PCO PM",
        "CK2L",
        "P2775",
        "PT",
      ].includes(p.code)
    )
      family_id = ids.cuisine;
    return { ...p, family_id };
  });
  return {
    products: nextProducts,
    families: [
      ...nextFamilies,
      ...retained.map((f, i) => ({ ...f, sort_order: 8 + i })),
    ],
    settings: {
      ...settings,
      heroes: slides(settings?.heroes),
      seasons: settings?.seasons?.map((s) => ({
        ...s,
        family_ids: [...new Set(s.family_ids.map(mapId))],
      })),
    },
    removed: families
      .filter((f) => !destinations.has(f.id) && !retainedIds.has(f.id))
      .map((f) => f.id),
  };
}
function applyFamilyUpdate({
  meta,
  setMeta,
  all,
  get,
  put,
  remove,
  transaction,
}) {
  const key = "family-update:" + version;
  if (meta(key)) return;
  // Small test seeds and unrelated installations do not get an invented catalogue.
  if (!all("family").some((f) => mapping[f.id])) return;
  transaction(() => {
    const products = all("product"),
      families = all("family"),
      settings = get("settings", "true");
    put("family-backup", {
      id: version,
      created_at: new Date().toISOString(),
      products,
      families,
      settings,
    });
    const next = planFamilyUpdate(products, families, settings);
    next.products.forEach((p) => put("product", p));
    next.families.forEach((f) => put("family", f));
    next.removed.forEach((id) => remove("family", id));
    put("settings", next.settings);
    setMeta(
      key,
      JSON.stringify({
        applied_at: new Date().toISOString(),
        families: next.families.length,
        products: products.length,
      }),
    );
  });
}
module.exports = {
  applyFamilyUpdate,
  planFamilyUpdate,
  familyUpdateVersion: version,
  familyIds: ids,
};
