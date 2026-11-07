import imported from "./data/catalog.preview.json";
import { defaultSettings } from "./catalog";
import type { Catalog, Product, Family } from "./types";
export function defaultCatalog(): Catalog {
  return structuredClone({
    products: imported.products as Product[],
    families: imported.families as Family[],
    settings: defaultSettings,
    sales: {},
  });
}
