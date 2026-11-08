import type { Family, Product } from "./types.ts";
import { catalogueFamilyOrder } from "./productGroups.ts";

export const MAX_MANUAL_POSITION = 1000000;
export const hasManualPosition = (p: Product) =>
  Number.isSafeInteger(p.manual_position) &&
  p.manual_position! > 0 &&
  p.manual_position! <= MAX_MANUAL_POSITION;

/** Manual positions are anchors inside the saved primary family only. */
export function orderedCatalogueProducts(
  products: readonly Product[],
  families: readonly Family[],
): Product[] {
  const sorted = [...products].sort(catalogueFamilyOrder(families));
  const byFamily = new Map<string, Product[]>();
  for (const product of sorted) {
    const family = byFamily.get(product.family_id) || [];
    family.push(product);
    byFamily.set(product.family_id, family);
  }
  return [...byFamily.values()].flatMap((family) => {
    const result = family.filter((p) => !hasManualPosition(p));
    const anchors = family
      .filter(hasManualPosition)
      .sort(
        (a, b) =>
          a.manual_position! - b.manual_position! || a.id.localeCompare(b.id),
      );
    let previous = -1;
    for (const anchor of anchors) {
      const index = Math.min(
        result.length,
        Math.max(anchor.manual_position! - 1, previous + 1),
      );
      result.splice(index, 0, anchor);
      previous = index;
    }
    return result;
  });
}

/** Keep the same relative order when a search/filter shows only a subset. */
export function catalogueOrder(
  products: readonly Product[],
  families: readonly Family[],
) {
  const ranks = new Map(
    orderedCatalogueProducts(products, families).map((p, i) => [p.id, i]),
  );
  const fallback = catalogueFamilyOrder(families);
  return (a: Product, b: Product) =>
    (ranks.get(a.id) ?? products.length) -
      (ranks.get(b.id) ?? products.length) || fallback(a, b);
}

export function planProductPosition(
  products: readonly Product[],
  families: readonly Family[],
  id: string,
  position: number | null,
): { id: string; manual_position: number | null }[] {
  if (
    position !== null &&
    (!Number.isSafeInteger(position) ||
      position < 1 ||
      position > MAX_MANUAL_POSITION)
  )
    throw new Error(
      "La position doit être un entier entre 1 et 1 000 000, ou le mode automatique.",
    );
  const product = products.find((p) => p.id === id);
  if (!product) throw new Error("Produit introuvable.");
  if (position === null) return [{ id, manual_position: null }];
  const family = orderedCatalogueProducts(
    products.filter((p) => p.family_id === product.family_id),
    families,
  );
  const next = family.filter((p) => p.id !== id);
  const index = Math.min(position - 1, next.length);
  next.splice(index, 0, product);
  const patches = [{ id, manual_position: index + 1 }];
  next.forEach((p, i) => {
    if (p.id !== id && hasManualPosition(p) && p.manual_position !== i + 1)
      patches.push({ id: p.id, manual_position: i + 1 });
  });
  return patches;
}
