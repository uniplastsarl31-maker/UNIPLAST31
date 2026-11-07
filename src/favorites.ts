export const FAVORITES_KEY = "uniplast.favorites.v1";
const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  value.trim() === value &&
  !/[\u0000-\u001f]/.test(value);
export function parseFavoriteIds(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw || "null");
    return Array.isArray(value)
      ? [...new Set(value.filter(validId))].slice(0, 5000)
      : [];
  } catch {
    return [];
  }
}
export function toggleFavoriteId(ids: string[], id: string): string[] {
  if (!validId(id)) return ids;
  return ids.includes(id)
    ? ids.filter((v) => v !== id)
    : [...ids, id].slice(-5000);
}
