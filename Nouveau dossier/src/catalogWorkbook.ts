import type { Family, Product } from "./types";

export type TransferMode = "weights" | "all";
export interface CatalogExport {
  export_id: string;
  created_at: string;
  products: Product[];
  families: Family[];
}
export interface ImportedCatalogRow {
  id: string;
  code: string;
  values: Record<string, string | number | boolean | null>;
}
type Kind =
  | "text"
  | "nullableText"
  | "number"
  | "integer"
  | "nullableNumber"
  | "nullableInteger"
  | "price"
  | "nullablePrice"
  | "boolean"
  | "date"
  | "family";
interface Column {
  field: keyof Product;
  label: string;
  kind: Kind;
  width: number;
  required?: boolean;
}
export const WORKBOOK_COLUMNS: Column[] = [
  {
    field: "name",
    label: "Nom du produit",
    kind: "text",
    width: 48,
    required: true,
  },
  { field: "barcode", label: "Code-barres", kind: "nullableText", width: 22 },
  {
    field: "family_id",
    label: "Famille",
    kind: "family",
    width: 28,
    required: true,
  },
  { field: "description", label: "Description", kind: "text", width: 55 },
  { field: "dimensions", label: "Dimensions", kind: "text", width: 25 },
  { field: "capacity", label: "Capacité", kind: "text", width: 20 },
  { field: "material", label: "Matière", kind: "text", width: 20 },
  {
    field: "weight_grams",
    label: "Poids (g)",
    kind: "nullableNumber",
    width: 17,
  },
  { field: "pack_size", label: "Unités par colis", kind: "integer", width: 20 },
  {
    field: "pack_label",
    label: "Nom du colis",
    kind: "text",
    width: 20,
    required: true,
  },
  {
    field: "unit_price_cents",
    label: "Prix unitaire (DA)",
    kind: "price",
    width: 21,
  },
  {
    field: "price_on_request",
    label: "Prix sur demande",
    kind: "boolean",
    width: 22,
  },
  { field: "available", label: "Disponible", kind: "boolean", width: 18 },
  {
    field: "availability_confirmed",
    label: "Disponibilité vérifiée",
    kind: "boolean",
    width: 25,
  },
  {
    field: "stock_cartons",
    label: "Stock en cartons",
    kind: "nullableInteger",
    width: 22,
  },
  { field: "is_new", label: "Nouveau produit", kind: "boolean", width: 20 },
  { field: "new_until", label: "Fin nouveauté (ISO)", kind: "date", width: 29 },
  {
    field: "upcoming",
    label: "Bientôt disponible",
    kind: "boolean",
    width: 23,
  },
  {
    field: "preorder_enabled",
    label: "Réservation ouverte",
    kind: "boolean",
    width: 24,
  },
  {
    field: "discount_price_cents",
    label: "Prix remisé (DA)",
    kind: "nullablePrice",
    width: 21,
  },
  {
    field: "discount_start",
    label: "Début promotion (ISO)",
    kind: "date",
    width: 29,
  },
  {
    field: "discount_end",
    label: "Fin promotion (ISO)",
    kind: "date",
    width: 29,
  },
  {
    field: "offer_title",
    label: "Titre de promotion",
    kind: "text",
    width: 32,
  },
  {
    field: "show_offer",
    label: "Afficher promotion",
    kind: "boolean",
    width: 23,
  },
  { field: "pinned", label: "Épingler", kind: "boolean", width: 17 },
  {
    field: "sort_order",
    label: "Ordre de sélection",
    kind: "integer",
    width: 23,
  },
];
const ID_LABEL = "Identifiant (ne pas modifier)",
  REF_LABEL = "Référence (ne pas modifier)",
  MAX_ROWS = 5000;
const header = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function workbookClass() {
  const library = await import("exceljs");
  return library.Workbook || library.default.Workbook;
}
export async function createCatalogWorkbook(
  data: CatalogExport,
): Promise<ArrayBuffer> {
  const Workbook = await workbookClass(),
    book = new Workbook();
  book.creator = "UNIPLAST";
  book.created = new Date(data.created_at);
  const sheet = book.addWorksheet("Produits", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });
  sheet.columns = [
    { header: ID_LABEL, key: "id", width: 40 },
    { header: REF_LABEL, key: "code", width: 24 },
    ...WORKBOOK_COLUMNS.map((c) => ({
      header: c.label,
      key: c.field,
      width: c.width,
    })),
    { header: "Famille ID (information)", key: "family_info", width: 40 },
    {
      header: "Photos (information - conservées)",
      key: "images_info",
      width: 55,
    },
  ];
  const nameCounts = new Map<string, number>();
  data.families.forEach((f) =>
    nameCounts.set(f.name, (nameCounts.get(f.name) || 0) + 1),
  );
  const families = new Map(
    data.families.map((f) => [
      f.id,
      (nameCounts.get(f.name) || 0) > 1 ? `${f.name} [${f.id}]` : f.name,
    ]),
  );
  for (const product of [...data.products].sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" }),
  )) {
    const values: Record<string, unknown> = {
      id: product.id,
      code: product.code,
      family_info: product.family_id,
      images_info: JSON.stringify(product.images || []),
    };
    for (const c of WORKBOOK_COLUMNS) {
      const value = product[c.field];
      values[c.field] =
        c.kind === "family"
          ? families.get(String(value)) || String(value)
          : c.kind === "boolean"
            ? value
              ? "Oui"
              : "Non"
            : c.kind === "price" || c.kind === "nullablePrice"
              ? value == null
                ? null
                : Number(value) / 100
              : (value ?? null);
    }
    sheet.addRow(values);
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(1, sheet.rowCount),
      column: WORKBOOK_COLUMNS.length + 2,
    },
  };
  sheet.getRow(1).height = 35;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF254496" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return;
    row.height = 29;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const editable = column > 2 && column <= WORKBOOK_COLUMNS.length + 2;
      cell.protection = { locked: !editable };
      cell.font = {
        size: 11,
        color: { argb: editable ? "FF17376B" : "FF68758A" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: editable
            ? rowIndex % 2
              ? "FFFFFFFF"
              : "FFF3F6FB"
            : "FFE8ECF2",
        },
      };
      cell.alignment = { vertical: "middle" };
      if (
        !editable ||
        WORKBOOK_COLUMNS[column - 3]?.kind === "nullableText" ||
        WORKBOOK_COLUMNS[column - 3]?.kind === "date"
      )
        cell.numFmt = "@";
      const spec = WORKBOOK_COLUMNS[column - 3];
      if (spec?.kind === "boolean")
        cell.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: ['"Oui,Non"'],
          showErrorMessage: true,
          errorTitle: "Choix attendu",
          error: "Choisissez Oui ou Non.",
        };
      if (spec?.kind === "price" || spec?.kind === "nullablePrice")
        cell.numFmt = "0.00";
      if (spec?.field === "weight_grams") cell.numFmt = "0.###";
    });
  });
  await sheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    autoFilter: true,
    sort: true,
  });
  const info = book.addWorksheet("Informations");
  info.columns = [{ width: 35 }, { width: 105 }];
  info.addRows([
    ["UNIPLAST CATALOGUE", "1"],
    ["Identifiant de l’export", data.export_id],
    ["Date de l’export", data.created_at],
    [
      "Mode conseillé",
      "Poids uniquement : seules les valeurs de Poids (g) seront proposées à la mise à jour.",
    ],
    [
      "Colonnes grises",
      "Identifiant, référence, photos et famille ID sont informatifs. Ne modifiez pas les identifiants.",
    ],
    [
      "Photos",
      "Les images restent dans le magasin. Les informations photos de cet Excel ne sont jamais réimportées.",
    ],
    ["Prix", "Saisissez les prix en DA. Exemple : 125,50 DA. Pas de formule."],
    [
      "Poids",
      "Saisissez les poids en grammes, sans unité dans la cellule. Une cellule vide correspond à un poids vide.",
    ],
    [
      "Dates",
      "Dates ISO : 2026-11-07T10:00:00.000Z. Laissez vide pour ne pas définir de date.",
    ],
    [
      "Familles",
      "Utilisez les noms présents dans l’onglet Familles. Les familles ne sont pas créées depuis ce fichier.",
    ],
    [
      "Révision",
      "Le site propose uniquement les modifications depuis cet export et vérifie les changements intervenus entre-temps.",
    ],
    [
      "Limites",
      "Format .xlsx, 3 Mo et 5 000 lignes maximum. Formules interdites. Les nouveaux produits et suppressions sont ignorés.",
    ],
  ]);
  info.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
    row.height = 38;
  });
  const helper = book.addWorksheet("Familles");
  helper.columns = [
    { header: "Identifiant", width: 42 },
    { header: "Nom", width: 35 },
  ];
  data.families
    .filter((f) => f.kind !== "new")
    .forEach((f) => helper.addRow([f.id, families.get(f.id)]));
  const buffer = await book.xlsx.writeBuffer();
  return new Uint8Array(buffer).slice().buffer;
}

// Check archive expansion before ExcelJS decodes a potentially hostile workbook.
export function preflightWorkbook(bytes: Uint8Array): void {
  if (!bytes.length || bytes.length > 3 * 1024 * 1024)
    throw new Error("Le fichier Excel doit faire au maximum 3 Mo.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Choisissez un véritable fichier Excel .xlsx.");
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  if (!count || count > 2000)
    throw new Error("Ce fichier Excel est trop complexe.");
  let pos = offset,
    expanded = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error("Archive Excel endommagée.");
    const flags = view.getUint16(pos + 8, true),
      size = view.getUint32(pos + 24, true),
      nameSize = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true);
    if (
      flags & 1 ||
      size === 0xffffffff ||
      pos + 46 + nameSize + extra + comment > bytes.length
    )
      throw new Error(
        "Les fichiers Excel chiffrés ou non standards ne sont pas acceptés.",
      );
    expanded += size;
    if (expanded > 50 * 1024 * 1024)
      throw new Error(
        "Le contenu décompressé du fichier Excel est trop volumineux.",
      );
    const name = new TextDecoder().decode(
      bytes.subarray(pos + 46, pos + 46 + nameSize),
    );
    if (/vbaProject|externalLinks|\.bin$/i.test(name))
      throw new Error("Les macros et liens externes ne sont pas acceptés.");
    pos += 46 + nameSize + extra + comment;
  }
}
function scalar(
  value: unknown,
  row: number,
): string | number | boolean | Date | null {
  if (value == null) return null;
  if (
    value instanceof Date ||
    ["string", "number", "boolean"].includes(typeof value)
  )
    return value as string | number | boolean | Date;
  if (
    typeof value === "object" &&
    value &&
    "richText" in value &&
    Array.isArray(value.richText)
  )
    return value.richText
      .map((x) => (typeof x.text === "string" ? x.text : ""))
      .join("");
  throw new Error(
    `Cellule non prise en charge à la ligne ${row}. Utilisez une valeur simple, sans formule ni lien.`,
  );
}
function text(value: unknown, row: number): string {
  const v = scalar(value, row);
  return v == null
    ? ""
    : v instanceof Date
      ? v.toISOString()
      : String(v).trim();
}
function number(value: unknown, row: number): number {
  const v = scalar(value, row);
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" &&
          /^[-+]?\d+(?:[.,]\d+)?$/.test(v.replace(/[\s\u00a0\u202f]/g, ""))
        ? Number(v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."))
        : NaN;
  if (!Number.isFinite(n))
    throw new Error(`Nombre invalide à la ligne ${row}.`);
  return n;
}
function parseValue(
  value: unknown,
  column: Column,
  row: number,
  families: Map<string, string>,
): string | number | boolean | null {
  const blank = value == null || value === "";
  if (column.kind === "boolean") {
    const v = text(value, row).toLowerCase();
    if (["oui", "true", "1"].includes(v)) return true;
    if (["non", "false", "0"].includes(v)) return false;
    throw new Error(
      `Choisissez Oui ou Non pour « ${column.label} », ligne ${row}.`,
    );
  }
  if (column.kind === "family") {
    const v = text(value, row),
      id =
        families.get(v) || (Array.from(families.values()).includes(v) ? v : "");
    if (!id) throw new Error(`Famille inconnue à la ligne ${row} : ${v}.`);
    return id;
  }
  if (column.kind === "date") {
    if (blank) return null;
    const v = scalar(value, row);
    if (v instanceof Date && Number.isFinite(v.getTime()))
      return v.toISOString();
    const d =
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(v)
        ? new Date(v)
        : null;
    if (!d || !Number.isFinite(d.getTime()))
      throw new Error(`Date ISO invalide à la ligne ${row}.`);
    return d.toISOString();
  }
  if (["text", "nullableText"].includes(column.kind)) {
    const v = text(value, row);
    if (column.required && !v)
      throw new Error(`« ${column.label} » est obligatoire à la ligne ${row}.`);
    if (v.length > 10000) throw new Error(`Texte trop long à la ligne ${row}.`);
    return !v && column.kind === "nullableText" ? null : v;
  }
  if (blank && column.kind.startsWith("nullable")) return null;
  const n = number(value, row);
  if (column.kind === "price" || column.kind === "nullablePrice") {
    if (n < 0 || n > 1000000 || Math.abs(Math.round(n * 100) - n * 100) > 1e-6)
      throw new Error(
        `Prix invalide à la ligne ${row} : deux décimales maximum, en DA.`,
      );
    return Math.round(n * 100);
  }
  if (column.kind === "integer" || column.kind === "nullableInteger") {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error(`Quantité entière positive attendue à la ligne ${row}.`);
  }
  if (column.field === "weight_grams" && (n <= 0 || n > 10000000))
    throw new Error(`Poids positif en grammes attendu à la ligne ${row}.`);
  return n;
}
export async function parseCatalogWorkbook(
  data: ArrayBuffer,
  mode: TransferMode = "weights",
): Promise<{ export_id: string; rows: ImportedCatalogRow[] }> {
  preflightWorkbook(new Uint8Array(data));
  const Workbook = await workbookClass(),
    book = new Workbook();
  await book.xlsx.load(data as never);
  const sheet = book.getWorksheet("Produits"),
    info = book.getWorksheet("Informations"),
    helpers = book.getWorksheet("Familles");
  if (
    !sheet ||
    !info ||
    !helpers ||
    text(info.getCell("A1").value, 1) !== "UNIPLAST CATALOGUE" ||
    text(info.getCell("B1").value, 1) !== "1"
  )
    throw new Error(
      "Utilisez le fichier Excel exporté depuis ce site, avec ses onglets d’origine.",
    );
  if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100)
    throw new Error("5 000 produits et 100 colonnes maximum.");
  let cells = 0;
  for (const ws of book.worksheets) {
    if (ws.rowCount > MAX_ROWS + 20 || ws.columnCount > 100)
      throw new Error("Le fichier contient trop de cellules.");
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        if (++cells > 200000)
          throw new Error("Le fichier contient trop de cellules.");
        const v = cell.value;
        if (
          v &&
          typeof v === "object" &&
          ("formula" in v || "sharedFormula" in v)
        )
          throw new Error(
            "Les formules Excel ne sont pas acceptées. Collez les valeurs seules.",
          );
      }),
    );
  }
  const export_id = text(info.getCell("B2").value, 2);
  if (!export_id || export_id.length > 200)
    throw new Error("Identifiant de l’export absent.");
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, i) => {
    const name = header(text(cell.value, 1));
    if (columns.has(name))
      throw new Error("Une colonne est répétée dans le fichier.");
    columns.set(name, i);
  });
  const idColumn = columns.get(header(ID_LABEL)),
    refColumn = columns.get(header(REF_LABEL));
  if (!idColumn || !refColumn)
    throw new Error(
      "Les colonnes Identifiant et Référence doivent être conservées.",
    );
  const specs = WORKBOOK_COLUMNS.filter(
    (c) =>
      (mode === "all" || c.field === "weight_grams") &&
      columns.has(header(c.label)),
  );
  if (!specs.length)
    throw new Error(
      mode === "weights"
        ? "La colonne Poids (g) est absente."
        : "Aucune colonne modifiable reconnue.",
    );
  const families = new Map<string, string>();
  helpers.eachRow((row, i) => {
    if (i > 1)
      families.set(
        text(row.getCell(2).value, i),
        text(row.getCell(1).value, i),
      );
  });
  const rows: ImportedCatalogRow[] = [],
    ids = new Set<string>(),
    codes = new Set<string>();
  for (let i = 2; i <= sheet.rowCount; i++) {
    const source = sheet.getRow(i),
      id = text(source.getCell(idColumn).value, i),
      code = text(source.getCell(refColumn).value, i);
    if (!id && !code) {
      if (
        specs.some(
          (c) => source.getCell(columns.get(header(c.label))!).value != null,
        )
      )
        throw new Error(`Identifiant et référence manquants à la ligne ${i}.`);
      continue;
    }
    if (!id || !code || id.length > 200 || code.length > 80)
      throw new Error(`Identifiant ou référence invalide à la ligne ${i}.`);
    if (ids.has(id) || codes.has(code))
      throw new Error(`Produit répété à la ligne ${i} : ${code}.`);
    ids.add(id);
    codes.add(code);
    const values: ImportedCatalogRow["values"] = {};
    for (const spec of specs)
      values[spec.field] = parseValue(
        source.getCell(columns.get(header(spec.label))!).value,
        spec,
        i,
        families,
      );
    rows.push({ id, code, values });
  }
  if (!rows.length) throw new Error("Le fichier ne contient aucun produit.");
  if (new TextEncoder().encode(JSON.stringify(rows)).length > 3.5 * 1024 * 1024)
    throw new Error("Le contenu à importer est trop volumineux.");
  return { export_id, rows };
}
