import { test } from "node:test";
import assert from "node:assert/strict";
import {
  storefrontTheme,
  storefrontThemeIds,
  storefrontThemes,
  validateStorefrontTheme,
} from "../src/seasonalTheme.ts";
import type { Settings } from "../src/types.ts";

test("seasonal theme is explicitly selected; absent legacy settings stay classic", () => {
  assert.equal(storefrontTheme({}), "classic");
  assert.equal(validateStorefrontTheme(undefined), null);
  assert.equal(new Set(storefrontThemeIds).size, 5);
  assert.deepEqual(
    storefrontThemes.map((theme) => theme.id),
    storefrontThemeIds,
  );
  for (const theme of storefrontThemeIds) {
    assert.equal(validateStorefrontTheme(theme), null);
    assert.equal(storefrontTheme({ storefront_theme: theme }), theme);
  }
});

test("unknown values cannot select arbitrary storefront styling", () => {
  for (const value of [
    null,
    "",
    "autumn",
    "CLASSIC",
    1,
    {},
    [],
    "classic evil",
  ]) {
    assert.equal(typeof validateStorefrontTheme(value), "string");
    assert.equal(
      storefrontTheme({ storefront_theme: value } as Pick<
        Settings,
        "storefront_theme"
      >),
      "classic",
    );
  }
});
