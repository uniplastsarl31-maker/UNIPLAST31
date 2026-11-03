import { test } from "node:test";
import assert from "node:assert/strict";
import { photoPreset, slideComposition, validateSlideComposition } from "../src/slider.ts";
import type { Hero } from "../src/types.ts";
const hero: Hero = { id: "old-slide", title: "Collection", image: "/assets/crystal.webp", body: "Texte conservé", cta: "Voir", eyebrow: "UNIPLAST", family_id: "collection", visible: true, scale: 1, x: 0, y: 0 };
test("old slides keep the product presentation; photo presets preserve content and original image", () => {
  assert.equal(slideComposition(hero).photo_mode, "product");
  assert.equal(validateSlideComposition(hero), null);
  for (const mode of ["behind", "circle", "rounded", "poster"] as const) {
    const p = photoPreset(hero, mode);
    assert.equal(p.id, hero.id); assert.equal(p.image, hero.image); assert.equal(p.title, hero.title);
    assert.equal(p.body, hero.body); assert.equal(p.family_id, hero.family_id);
    assert.equal(validateSlideComposition(p), null);
    if (mode !== "poster") { assert.equal(p.composition?.blend, "normal"); assert.equal(p.fit, "cover"); }
  }
});
test("invalid frame colors, animation bounds and image positions are rejected", () => {
  for (const bad of [{ frame_color: "url(bad)" }, { frame_size: 101 }, { frame_width: 0 }, { duration_ms: 9000 }, { frame_visible: "yes" }, { unknown: true }]) {
    assert(validateSlideComposition({ ...hero, composition: bad } as Hero));
  }
  assert(validateSlideComposition({ ...hero, x: Infinity }));
  assert(validateSlideComposition({ ...hero, y: -51 }));
});
