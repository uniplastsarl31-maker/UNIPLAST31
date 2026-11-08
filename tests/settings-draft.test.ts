import { test } from "node:test";
import assert from "node:assert/strict";
import type { Settings } from "../src/types.ts";
import { mergeSettingsDraft } from "../src/settingsDraft.ts";

test("a late media upload keeps newer edits made on another settings page", () => {
  const base = {
    company_name: "Ancien nom",
    youtube_url: "https://youtube.com/@ancien",
    videos: [],
    storefront_theme: "classic",
  } as unknown as Settings;
  const current = {
    ...base,
    company_name: "Nouveau nom",
    youtube_url: "https://youtube.com/@nouveau",
    storefront_theme: "ramadan-night",
  } as Settings;
  const next = {
    ...base,
    videos: [
      {
        id: "clip",
        title: "Produit",
        source: "upload",
        url: "/api/local/file?id=clip",
        poster_url: "",
        visible: true,
      },
    ],
  } as Settings;
  const before = structuredClone({ base, current, next });
  const result = mergeSettingsDraft(current, base, next, [
    "videos",
    "youtube_url",
  ]);
  assert.equal(result.company_name, "Nouveau nom");
  assert.equal(result.youtube_url, "https://youtube.com/@nouveau");
  assert.equal(result.storefront_theme, "ramadan-night");
  assert.deepEqual(result.videos, next.videos);
  assert.deepEqual({ base, current, next }, before);
});

test("section changes affect only their edited fields and preserve optional saved options", () => {
  const base = {
    company_name: "UNIPLAST",
    storefront_theme: "classic",
    videos_enabled: true,
  } as Settings;
  const current = {
    ...base,
    custom_order: { enabled: true, terms: "Conditions conservées" },
  } as Settings;
  const result = mergeSettingsDraft(
    current,
    base,
    { ...base, storefront_theme: "newyear-snow", company_name: "Autre" },
    ["storefront_theme"],
  );
  assert.equal(result.storefront_theme, "newyear-snow");
  assert.equal(result.company_name, "UNIPLAST");
  assert.equal(result.videos_enabled, true);
  assert.deepEqual(result.custom_order, current.custom_order);
  assert.equal(
    mergeSettingsDraft(current, base, base, ["storefront_theme"]),
    current,
  );
});
