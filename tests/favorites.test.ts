import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFavoriteIds, toggleFavoriteId } from "../src/favorites.ts";

test("favorites persist only product identifiers, survive reload and toggle without storing old prices", () => {
  let ids = toggleFavoriteId([], "product-one");
  ids = toggleFavoriteId(ids, "product-two");
  assert.deepEqual(parseFavoriteIds(JSON.stringify(ids)), [
    "product-one",
    "product-two",
  ]);
  assert.deepEqual(toggleFavoriteId(ids, "product-one"), ["product-two"]);
  assert.deepEqual(
    parseFavoriteIds(
      JSON.stringify([
        { id: "private", unit_price_cents: 999 },
        "product-two",
        "product-two",
      ]),
    ),
    ["product-two"],
  );
  assert.deepEqual(ids, ["product-one", "product-two"]);
});
test("unrelated, malformed and excessive saved favorites are handled safely", () => {
  for (const value of [null, "invalid-json", '{"catalog":[]}'])
    assert.deepEqual(parseFavoriteIds(value), []);
  assert.deepEqual(parseFavoriteIds('[null,5,""," leading-space","valid"]'), [
    "valid",
  ]);
  assert.equal(
    parseFavoriteIds(
      JSON.stringify(Array.from({ length: 5001 }, (_, n) => "p" + n)),
    ).length,
    5000,
  );
});
