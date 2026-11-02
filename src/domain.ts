import type {
  CartItem,
  Order,
  OrderLine,
  Product,
  Season,
  Family,
  Settings,
  ProductDisplay,
  CustomOrderOptions,
  FamilyOptions,
  CustomRequestItem,
} from "./types";

export const defaultProductDisplay: ProductDisplay = {
  weight: true,
  material: true,
  dimensions: true,
  capacity: true,
  barcode: true,
  pack: true,
  availability: true,
  description: true,
  new_badge: true,
  related_products: true,
  hide_empty: true,
};
export const defaultCustomOrder: CustomOrderOptions = {
  enabled: true,
  terms: "",
  min_units: 0,
  minimum_scope: "per_item",
  require_photo: false,
  require_acceptance: true,
  max_items: 10,
};
export const defaultFamilyOptions: FamilyOptions = {
  slider: true,
  introduction: true,
  promotions: true,
  quick_navigation: true,
  custom_link: true,
};
export const productDisplay = (s: Pick<Settings, "product_display">) => ({
  ...defaultProductDisplay,
  ...s.product_display,
});
export const customOrderOptions = (s: Pick<Settings, "custom_order">) => ({
  ...defaultCustomOrder,
  ...s.custom_order,
});
export const familyOptions = (s: Pick<Settings, "family_options">) => ({
  ...defaultFamilyOptions,
  ...s.family_options,
});
export const isNewProduct = (p: Product, now = Date.now()) =>
  p.is_new && (!p.new_until || Date.parse(p.new_until) > now);
export const matchesFamily = (p: Product, f: Family, now = Date.now()) =>
  f.kind === "new" ? isNewProduct(p, now) : p.family_id === f.id;

export function productSpecifications(
  p: Product,
  settings: Settings,
): [string, string][] {
  const d = productDisplay(settings);
  const rows: [boolean, string, string | null | undefined][] = [
    [d.pack, "Colisage", `${p.pack_size} unités / ${p.pack_label}`],
    [d.dimensions, "Dimensions", p.dimensions],
    [d.capacity, "Capacité", p.capacity],
    [
      d.weight,
      "Poids unitaire",
      p.weight_grams == null
        ? ""
        : `${new Intl.NumberFormat("fr-DZ").format(p.weight_grams)} g`,
    ],
    [d.material, "Matière", p.material],
    [d.barcode, "Code-barres", p.barcode],
  ];
  return rows
    .filter(([visible, , value]) => visible && (!d.hide_empty || !!value))
    .map(([, label, value]) => [label, value || "Non renseigné"]);
}

export function validateFeatureSettings(
  s: Pick<Settings, "product_display" | "custom_order" | "family_options">,
): string | null {
  for (const [value, defaults] of [
    [s.product_display, defaultProductDisplay],
    [s.family_options, defaultFamilyOptions],
  ] as const) {
    if (
      value != null &&
      (typeof value !== "object" ||
        Array.isArray(value) ||
        Object.entries(value).some(
          ([k, v]) => !(k in defaults) || typeof v !== "boolean",
        ))
    )
      return "Option d’affichage invalide.";
  }
  const c = customOrderOptions(s);
  if (
    s.custom_order != null &&
    (typeof s.custom_order !== "object" ||
      Array.isArray(s.custom_order) ||
      Object.keys(s.custom_order).some((k) => !(k in defaultCustomOrder)))
  )
    return "Réglages sur mesure invalides.";
  if (
    [c.enabled, c.require_photo, c.require_acceptance].some(
      (v) => typeof v !== "boolean",
    ) ||
    typeof c.terms !== "string" ||
    c.terms.length > 10000 ||
    !Number.isSafeInteger(c.min_units) ||
    c.min_units < 0 ||
    c.min_units > 10000000 ||
    !["per_item", "total"].includes(c.minimum_scope) ||
    !Number.isInteger(c.max_items) ||
    c.max_items < 1 ||
    c.max_items > 10
  )
    return "Vérifiez les conditions, le minimum (0 à 10 000 000 pièces) et le nombre d’articles (1 à 10).";
  return null;
}
export function validateCustomItems(
  items: CustomRequestItem[] | undefined,
  options: CustomOrderOptions,
  accepted = false,
): string | null {
  if (!options.enabled)
    return "Les demandes sur mesure sont momentanément fermées.";
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > options.max_items
  )
    return `Ajoutez de 1 à ${options.max_items} articles à votre demande.`;
  if (
    items.some(
      (i) =>
        !i ||
        typeof i.name !== "string" ||
        !i.name.trim() ||
        i.name.length > 150 ||
        !Number.isSafeInteger(i.quantity_units) ||
        i.quantity_units < 1 ||
        i.quantity_units > 10000000 ||
        !Array.isArray(i.images) ||
        i.images.length > 2 ||
        i.images.some((x) => typeof x !== "string" || x.length > 500),
    )
  )
    return "Chaque article doit avoir un nom, une quantité entière et au maximum 2 photos.";
  if (options.require_photo && items.some((i) => !i.images.length))
    return "Ajoutez une photo pour chaque article.";
  if (
    options.min_units > 0 &&
    (options.minimum_scope === "per_item"
      ? items.some((i) => i.quantity_units < options.min_units)
      : items.reduce((n, i) => n + i.quantity_units, 0) < options.min_units)
  )
    return `Minimum : ${options.min_units.toLocaleString("fr-FR")} pièces ${options.minimum_scope === "per_item" ? "par article" : "au total"}.`;
  if (options.terms.trim() && options.require_acceptance && accepted !== true)
    return "Veuillez accepter les conditions de fabrication.";
  return null;
}

export const ORDER_LABELS = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};
export const REQUEST_LABELS = {
  pending: "À examiner",
  reviewing: "En cours d’examen",
  accepted: "Acceptée",
  declined: "Déclinée",
};
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (s) => String(s.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (s) => String(s.charCodeAt(0) - 1776))
    .toLowerCase()
    .trim();
}
export const compareProductNames = (a: Product, b: Product) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true }) ||
  a.code.localeCompare(b.code, "fr", { numeric: true });
export function belowPrice(
  p: Product,
  maximumCents: number,
  authenticatedByPhone: boolean,
  now = Date.now(),
): boolean {
  return (
    authenticatedByPhone &&
    !p.price_hidden &&
    !p.price_on_request &&
    Number.isSafeInteger(maximumCents) &&
    maximumCents > 0 &&
    priceOf(p, now) < maximumCents
  );
}
export function normalizeBarcode(value: string): string {
  return normalizeSearch(value)
    .replace(/^\][a-z]\d/i, "")
    .replace(/\s/g, "");
}
export function findBarcodeProduct(
  products: Product[],
  value: string,
): Product | undefined {
  const code = normalizeBarcode(value);
  const same = (barcode: string | null) => {
    if (!barcode || !code) return false;
    const stored = normalizeBarcode(barcode);
    return (
      stored === code ||
      (/^\d{12,13}$/.test(stored) &&
        /^\d{12,13}$/.test(code) &&
        stored.padStart(13, "0") === code.padStart(13, "0"))
    );
  };
  return products.find((p) => same(p.barcode));
}
export function activeDiscount(product: Product, now = Date.now()): boolean {
  if (product.price_hidden)
    return (
      !!product.public_discount_percent &&
      !!product.discount_start &&
      !!product.discount_end &&
      Date.parse(product.discount_start) <= now &&
      now < Date.parse(product.discount_end)
    );
  return (
    product.discount_price_cents !== null &&
    product.discount_price_cents >= 0 &&
    product.discount_price_cents < product.unit_price_cents &&
    !!product.discount_start &&
    !!product.discount_end &&
    Date.parse(product.discount_start) <= now &&
    now < Date.parse(product.discount_end)
  );
}
export const priceOf = (p: Product, now = Date.now()) =>
  p.price_hidden
    ? 0
    : activeDiscount(p, now)
      ? p.discount_price_cents!
      : p.unit_price_cents;
export const discountPercent = (p: Product, now = Date.now()) =>
  p.price_hidden
    ? activeDiscount(p, now)
      ? p.public_discount_percent || 0
      : 0
    : p.unit_price_cents > 0 && activeDiscount(p, now)
      ? Math.round(
          (100 * (p.unit_price_cents - priceOf(p, now))) / p.unit_price_cents,
        )
      : 0;
export const canBuy = (p: Product) =>
  !p.price_hidden &&
  p.available &&
  p.availability_confirmed &&
  !p.price_on_request &&
  !p.upcoming &&
  (p.stock_cartons === null || p.stock_cartons > 0);
export function assertQuantity(cartons: number, product?: Product): void {
  if (!Number.isInteger(cartons) || cartons < 1 || cartons > 10000)
    throw new Error(
      "Le nombre de cartons doit être un entier compris entre 1 et 10000.",
    );
  if (
    product &&
    product.stock_cartons !== null &&
    cartons > product.stock_cartons
  )
    throw new Error(
      `Stock disponible : ${product.stock_cartons} ${product.pack_label}(s).`,
    );
}
export function orderLine(
  product: Product,
  cartons: number,
  now = Date.now(),
): OrderLine {
  if (product.price_hidden)
    throw new Error(
      "Connectez-vous avec un compte agréé pour consulter les tarifs.",
    );
  assertQuantity(cartons);
  const unit = priceOf(product, now),
    units = cartons * product.pack_size;
  return {
    product_id: product.id,
    name: product.name,
    code: product.code,
    barcode: product.barcode,
    pack_label: product.pack_label,
    unit_price_cents: unit,
    original_unit_price_cents: product.unit_price_cents,
    pack_size: product.pack_size,
    cartons,
    total_units: units,
    carton_price_cents: unit * product.pack_size,
    discount_cents: (product.unit_price_cents - unit) * units,
    total_cents: unit * units,
  };
}
export function activeSeasons(
  seasons: Season[],
  timezone: string,
  now = Date.now(),
): Season[] {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return seasons.filter(
    (s) => s.visible && s.starts_on <= day && day <= s.ends_on,
  );
}
export function safeWebUrl(value: string): string {
  if (!value) return "";
  if (/^\/api\/local\/file\?id=[a-f0-9-]{36}$/.test(value)) return value;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function cartTotals(
  cart: CartItem[],
  products: Product[],
  shipping = 0,
  now = Date.now(),
) {
  const lines = cart.flatMap((item) => {
    const p = products.find((p) => p.id === item.product_id);
    return p ? [orderLine(p, item.cartons, now)] : [];
  });
  const discounted = lines.reduce((s, i) => s + i.total_cents, 0),
    discount = lines.reduce((s, i) => s + i.discount_cents, 0);
  return {
    lines,
    subtotal: discounted + discount,
    discount,
    shipping: lines.length ? shipping : 0,
    total: discounted + (lines.length ? shipping : 0),
    cartons: lines.reduce((s, i) => s + i.cartons, 0),
    units: lines.reduce((s, i) => s + i.total_units, 0),
  };
}
export function money(cents: number, currency = "DZD"): string {
  const val = new Intl.NumberFormat("fr-DZ", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${val} ${currency === "DZD" ? "DA" : currency}`;
}
export function timeRemaining(end: string | null, now = Date.now()): string {
  if (!end) return "";
  const diff = Date.parse(end) - now;
  if (diff <= 0) return "Offre terminée";
  const days = Math.floor(diff / 86400000),
    hours = Math.floor(diff / 3600000) % 24,
    mins = Math.floor(diff / 60000) % 60;
  return days > 0 ? `${days} j ${hours} h` : `${hours} h ${mins} min`;
}
export function validateProduct(p: Product): string | null {
  if (!p.name.trim() || !p.code.trim() || !p.family_id)
    return "Le nom, la référence et la collection sont obligatoires.";
  if (
    p.name.length > 150 ||
    p.code.length > 80 ||
    (p.barcode && p.barcode.length > 80)
  )
    return "Le nom, la référence ou le code-barres dépasse la longueur autorisée.";
  if (
    !Number.isSafeInteger(p.unit_price_cents) ||
    p.unit_price_cents < 0 ||
    p.unit_price_cents > 100000000
  )
    return "Saisissez un prix valide inférieur ou égal à un million.";
  if (!Number.isInteger(p.pack_size) || p.pack_size < 1 || p.pack_size > 10000)
    return "Le colisage doit être un entier compris entre 1 et 10000.";
  if (
    p.stock_cartons !== null &&
    (!Number.isInteger(p.stock_cartons) || p.stock_cartons < 0)
  )
    return "Le stock doit être un nombre entier de cartons positif ou nul.";
  if (p.discount_price_cents !== null) {
    if (p.price_on_request)
      return "Renseignez un tarif avant de configurer une promotion.";
    if (
      !Number.isInteger(p.discount_price_cents) ||
      p.discount_price_cents < 0 ||
      p.discount_price_cents >= p.unit_price_cents
    )
      return "Le prix remisé doit être positif ou nul et inférieur au prix initial.";
    if (
      !p.discount_start ||
      !p.discount_end ||
      !Number.isFinite(Date.parse(p.discount_start)) ||
      !Number.isFinite(Date.parse(p.discount_end)) ||
      Date.parse(p.discount_start) >= Date.parse(p.discount_end)
    )
      return "Définissez une période de promotion valide.";
  }
  if (
    p.weight_grams != null &&
    (!Number.isFinite(p.weight_grams) ||
      p.weight_grams <= 0 ||
      p.weight_grams > 10000000)
  )
    return "Le poids doit être un nombre positif, en grammes.";
  if (p.images.length > 10) return "10 images maximum par produit.";
  if (
    typeof p.is_new !== "boolean" ||
    (p.new_until != null &&
      (typeof p.new_until !== "string" ||
        !Number.isFinite(Date.parse(p.new_until))))
  )
    return "Choisissez un état et une date de fin valides pour la nouveauté.";
  return null;
}
export function salesStats(orders: Order[], since = 0) {
  const included = orders.filter(
    (o) =>
      !o.preview &&
      ["confirmed", "preparing", "delivered"].includes(o.status) &&
      Date.parse(o.created_at) >= since,
  );
  const revenue = included.reduce((s, o) => s + o.total_cents, 0),
    units = included
      .flatMap((o) => o.items)
      .reduce((s, i) => s + i.total_units, 0),
    cartons = included
      .flatMap((o) => o.items)
      .reduce((s, i) => s + i.cartons, 0);
  const products: Record<
    string,
    { name: string; cartons: number; units: number; revenue: number }
  > = {};
  included.forEach((o) =>
    o.items.forEach((i) => {
      const p = (products[i.product_id] ??= {
        name: i.name,
        cartons: 0,
        units: 0,
        revenue: 0,
      });
      p.cartons += i.cartons;
      p.units += i.total_units;
      p.revenue += i.total_cents;
    }),
  );
  return {
    revenue,
    count: included.length,
    average: included.length ? Math.round(revenue / included.length) : 0,
    units,
    cartons,
    products: Object.entries(products).sort(
      (a, b) => b[1].cartons - a[1].cartons,
    ),
  };
}
/** Transparent ranking: manual pins/order, availability, completed sales, then expiring offers. */
export function rankProducts(
  products: Product[],
  sales: Record<string, number>,
  now = Date.now(),
): Product[] {
  const score = (p: Product) =>
    (p.pinned ? 1e9 : 0) +
    (canBuy(p) ? 1e7 : 0) +
    (sales[p.id] || 0) * 1000 +
    (activeDiscount(p, now)
      ? Math.max(0, 300 - (Date.parse(p.discount_end!) - now) / 3600000)
      : 0) -
    p.sort_order;
  return [...products].sort((a, b) => score(b) - score(a));
}
