import type { Product } from "./types.ts";

export const completenessFilters = [
  { value: "", label: "Tous" },
  { value: "missing", label: "Données à compléter" },
  { value: "photo", label: "Sans photo" },
  { value: "barcode", label: "Sans code-barres" },
  { value: "weight", label: "Sans poids" },
  { value: "price", label: "Sans prix" },
  { value: "dimensions", label: "Sans dimensions" },
  { value: "material", label: "Sans matière" },
] as const;

export type CompletenessFilter = (typeof completenessFilters)[number]["value"];
type MissingField = Exclude<CompletenessFilter, "" | "missing">;

const blank = (value: unknown) => typeof value !== "string" || !value.trim();
const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function missingProductData(product: Product): MissingField[] {
  const missing: MissingField[] = [];
  if (!product.images?.some((image) => !blank(image?.url)))
    missing.push("photo");
  if (blank(product.barcode)) missing.push("barcode");
  if (!positive(product.weight_grams)) missing.push("weight");
  if (product.price_on_request || !positive(product.unit_price_cents))
    missing.push("price");
  if (blank(product.dimensions)) missing.push("dimensions");
  if (blank(product.material)) missing.push("material");
  return missing;
}

export function matchesCompletenessFilter(
  product: Product,
  filter: CompletenessFilter,
): boolean {
  if (!filter) return true;
  const missing = missingProductData(product);
  return filter === "missing" ? missing.length > 0 : missing.includes(filter);
}

export function completenessCounts(
  products: readonly Product[],
): Record<CompletenessFilter, number> {
  const counts: Record<CompletenessFilter, number> = {
    "": products.length,
    missing: 0,
    photo: 0,
    barcode: 0,
    weight: 0,
    price: 0,
    dimensions: 0,
    material: 0,
  };
  for (const product of products) {
    const missing = missingProductData(product);
    if (missing.length) counts.missing++;
    for (const field of missing) counts[field]++;
  }
  return counts;
}
