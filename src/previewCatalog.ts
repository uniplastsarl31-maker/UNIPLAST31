import imported from "./data/catalog.preview.json";
import { defaultSettings } from "./catalog";
import type { Catalog, Product } from "./types";
export function defaultCatalog(): Catalog {
  return structuredClone({
    products: imported.products as Product[],
    families: imported.families,
    settings: defaultSettings,
    sales: {},
  });
}
