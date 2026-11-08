import type { Product } from "./types.ts";

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

// Names and headings only: no product records or ordering are changed.
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
