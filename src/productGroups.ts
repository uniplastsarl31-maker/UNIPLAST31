import type { Family, Product } from "./types.ts";
import { compareProductNames } from "./domain.ts";

export interface ProductGroup {
  key: string;
  label: string;
}

function normalized(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[œŒ]/g, "OE")
    .replace(/[æÆ]/g, "AE")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Derive headings and sorting keys without changing any product record.
// Series aliases cover both original and subsequently renamed catalogue names.
const groups: readonly [RegExp, string][] = [
  [/^BASSINES?\b/, "Bassines"],
  [/^(?:BOITES? (?:A )?)?CEREALES?\b/, "Boîtes à céréales"],
  [/^(?:BOITES? )?(?:CRYSTAL|CRISTAL)\b/, "Boîtes Crystal"],
  [/^BOITES? (?:D )?EMBALLAGE CARRE/, "Boîtes d’emballage carrées"],
  [/^BOITES? (?:D )?EMBALLAGE RECTANG/, "Boîtes d’emballage rectangulaires"],
  [/^BOITES? (?:D )?EMBALLAGE ROND/, "Boîtes d’emballage rondes"],
  [/^BOITES? (?:A )?(?:EPICES?|TAWABIL)\b/, "Boîtes à épices"],
  [/^(?:BOITES? )?FORMULE\b/, "Boîtes Formule"],
  [/^(?:BOITES? )?MIAMI\b/, "Boîtes Miami"],
  [/^(?:BOITES? )?NEDJMA\b/, "Boîtes Nedjma"],
  [/^BOITES? (?:RANGEMENT )?FRIGO\b/, "Boîtes de réfrigérateur Tassili"],
  [/^(?:BOITES? )?SABIRA\b/, "Boîtes Sabira"],
  [/^(?:BOITES? )?SAHLA\b/, "Boîtes Sahla"],
  [/^BOITES? (?:A )?SANDWICH/, "Boîtes à sandwich"],
  [/^(?:BOITES? )?SHEMS\b/, "Boîtes Shems"],
  [/^(?:BOITES? )?SPINNER\b/, "Boîtes Spinner"],
  [/^(?:BOITES? )?STAR\b/, "Boîtes Star"],
  [/^(?:BOITES? )?SWING\b/, "Boîtes Swing"],
  [/^(?:BOITES? )?TOP CHEF\b/, "Boîtes Top Chef"],
  [/^(?:(?:CONTENEURS?|BOITES?) )?CLIPSO\b/, "Conteneurs Clipso"],
  [/^BOLS?\b/, "Bols"],
  [/^BONBONNES?\b/, "Bonbonnes à eau"],
  [/^SERVICE BROC\b/, "Services à broc"],
  [/^SERVICES? (?:COCKTAIL|COCTAIL)\b/, "Services à cocktail"],
  [/^BROCS?\b/, "Brocs"],
  [/^BROSSES? (?:DE )?TOILETTE\b/, "Brosses de toilette"],
  [/^CHAISES?\b/, "Chaises"],
  [/^CHARIOTS?\b/, "Chariots"],
  [/^CINTRES?\b/, "Cintres"],
  [/^COMMODES?\b/, "Commodes"],
  [/^CORB(?:EILLE|ELLE)S?\b/, "Corbeilles"],
  [/^CUILL(?:ERE|RE)S?\b/, "Cuillères"],
  [/^CUVETTES?\b/, "Cuvettes"],
  [/^DISTRIBUTEURS? (?:DE )?SAVON\b/, "Distributeurs de savon"],
  [/^EGOUTTOIRS?\b/, "Égouttoirs"],
  [/^ESSOREUSES?\b/, "Essoreuses"],
  [/^ESSUIE TOUT\b/, "Essuie-tout"],
  [/^GLACIERES?\b/, "Glacières"],
  [/^GOB(?:E)?LETS?\b/, "Gobelets"],
  [/^GOURDES?\b/, "Gourdes"],
  [/^KIT (?:DE )?BANIO\b/, "Kits de bain"],
  [/^LOUCHES?\b/, "Louches"],
  [/^MAIDA\b/, "Tables Maïda"],
  [/^PAILLES?\b/, "Pailles"],
  [/^PALETTES?\b/, "Palettes"],
  [/^PANIERS?\b/, "Paniers"],
  [/^PASSOIRES?\b/, "Passoires"],
  [/^PELLES?\b/, "Pelles"],
  [/^PLATEAUX?\b/, "Plateaux"],
  [/^POLYSTYR(?:E|NE|ENE)\b/, "Polystyrène"],
  [/^PORTE CINTRES?\b/, "Porte-cintres"],
  [/^PORTE GOB(?:E)?LE/, "Porte-gobelets"],
  [/^PORTE MANGER\b/, "Porte-manger"],
  [/^PORTE OEUFS?\b/, "Porte-œufs"],
  [/^PORTE STYLOS?\b/, "Porte-stylos"],
  [/^POTS? (?:A |DE )?FLEURS?\b/, "Pots de fleurs"],
  [/^POUBELLES?\b/, "Poubelles"],
  [/^PRESSE CITRONS?\b/, "Presse-citrons"],
  [/^RANGE CHAUSSURES?\b/, "Range-chaussures"],
  [/^RANGEMENTS?\b/, "Rangements"],
  [/^RONDEAUX?\b/, "Rondeaux"],
  [/^SALADIERS?\b/, "Saladiers"],
  [/^SEAUX?\b/, "Seaux"],
  [/^SECHE LINGE\b/, "Sèche-linge"],
  [/^SHOP\b/, "Shop"],
  [/^SUPPORTS?\b/, "Supports"],
  [/^(?:TABLES?\b|ABLE CHREA\b)/, "Tables"],
  [/^TABOURETS?\b/, "Tabourets"],
  [/^VASES?\b/, "Vases"],
  [/^VERRES?\b/, "Verres"],
  [/^VERSEURS?\b/, "Verseurs"],
  [/^VISIERES?\b/, "Visières de protection"],
];

const variant =
  /^(?:REF|REFERENCE|SERIE|LOT|MODELE|DIAM|DIAMETRE|HAUTEUR|COULEUR|COLORE|COLOREE|BLANC|BLANCHE|TRANSPARENT|TRANSPARENTE|DECORE|DECOREE|MINI|MAXI|PROMAXI|PM|MM|GM)$/;
const keyOf = (label: string) =>
  normalized(label).toLowerCase().replace(/ /g, "-");

export function productGroup(
  product: Pick<Product, "name" | "name_fr">,
): ProductGroup {
  const name = normalized(product.name?.trim() || product.name_fr || "");
  // Legacy replacement characters in a few names represented accented vowels.
  // Match a recognized type from the intact prefix before using the fallback.
  const matchName = name
    .replace(/^CUILL RE\b/, "CUILLERE")
    .replace(/^S CHE\b/, "SECHE")
    .replace(/^POLYSTYR NE\b/, "POLYSTYRENE");
  for (const [pattern, label] of groups)
    if (pattern.test(matchName)) return { key: keyOf(label), label };

  const words = name.split(" ").filter(Boolean);
  const cutoff = words.findIndex(
    (word) => /\d/.test(word) || variant.test(word),
  );
  const phrase = (cutoff < 0 ? words : words.slice(0, cutoff))
    .slice(0, 5)
    .join(" ");
  const lower = (phrase || "PRODUITS").toLocaleLowerCase("fr-FR");
  const label = lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
  return { key: keyOf(label), label };
}

function cataloguePosition(product: Product): [number, number] {
  const name = normalized(product.name?.trim() || product.name_fr || "");
  // Sets follow individual products; their piece count is not a model number.
  const set =
    /\bSERIE\b/.test(name) || Number(name.match(/\bS\s*(\d+)\b/)?.[1]) > 1
      ? 1
      : 0;
  // RC10 REF 02 is model 10, not model 2. Otherwise an explicit REF takes
  // precedence over capacity, dimensions and S/4 package quantities.
  const beforeReference = name.split(/\bREF(?:ERENCE)?(?=\b|\d)/)[0];
  const model = beforeReference.match(/\b(?:RC|R)\s*(\d+)\b/);
  const reference = name.match(/\bREF(?:ERENCE)?\s*(?:N(?:O)?\s*)?(\d+)\b/);
  const size = (product.name?.trim() || product.name_fr || "").match(
    /\d+(?:[.,]\d+)?/,
  );
  const number = model?.[1] ?? reference?.[1] ?? size?.[0];
  return [set, number == null ? Infinity : Number(number.replace(",", "."))];
}

/** Ordering within one saved family: types, then ascending model/reference. */
export function compareCatalogueProducts(a: Product, b: Product): number {
  const groupOrder = productGroup(a).key.localeCompare(
    productGroup(b).key,
    "fr",
    {
      sensitivity: "base",
      numeric: true,
    },
  );
  if (groupOrder) return groupOrder;
  const left = cataloguePosition(a),
    right = cataloguePosition(b);
  return left[0] - right[0] || left[1] - right[1] || compareProductNames(a, b);
}

/** Preserve saved family order before comparing references within each family. */
export function catalogueFamilyOrder(families: readonly Family[]) {
  const positions = new Map(
    families
      .filter((family) => family.kind !== "new")
      .map((family, index) => ({ family, index }))
      .sort(
        (a, b) =>
          a.family.sort_order - b.family.sort_order || a.index - b.index,
      )
      .map(({ family }, index) => [family.id, index]),
  );
  return (a: Product, b: Product): number => {
    if (a.family_id !== b.family_id) {
      return (
        (positions.get(a.family_id) ?? families.length) -
          (positions.get(b.family_id) ?? families.length) ||
        a.family_id.localeCompare(b.family_id, "fr")
      );
    }
    return compareCatalogueProducts(a, b);
  };
}
