import type { Hero, SlideComposition } from "./types";

// Missing composition preserves the original product/disc presentation.
export const defaultSlideComposition: SlideComposition = {
  photo_mode: "product",
  frame_visible: true,
  frame_size: 85,
  frame_width: 1,
  frame_color: "#a8bacd",
  background_color: "#dfeaf0",
  blend: "multiply",
  signature_visible: true,
  transition: "fade",
  duration_ms: 600,
};
export function slideComposition(h: Hero): SlideComposition {
  const c = { ...defaultSlideComposition, ...h.composition };
  if (c.photo_mode !== "product" && h.composition?.blend === undefined)
    c.blend = "normal";
  return c;
}
export function photoPreset(
  h: Hero,
  preset: "product" | "behind" | "circle" | "rounded" | "poster",
): Hero {
  const c = slideComposition(h);
  if (preset === "poster")
    return { ...h, layout: "poster", fit: "contain", scale: 1, x: 0, y: 0 };
  return {
    ...h,
    layout: "split",
    fit: preset === "product" ? "contain" : "cover",
    scale: 1,
    x: 0,
    y: 0,
    composition: {
      ...c,
      photo_mode: preset,
      frame_visible: true,
      frame_size: preset === "behind" ? 88 : 90,
      frame_width: preset === "product" ? 1 : 6,
      frame_color: preset === "product" ? "#a8bacd" : "#ffffff",
      background_color: "#dfeaf0",
      blend: "normal",
      signature_visible: preset === "product",
    },
  };
}
export function validateSlideComposition(h: Hero): string | null {
  if (
    h.composition !== undefined &&
    (!h.composition ||
      typeof h.composition !== "object" ||
      Array.isArray(h.composition) ||
      Object.keys(h.composition).some((k) => !(k in defaultSlideComposition)))
  )
    return "Réglages du cadre invalides.";
  const c = slideComposition(h);
  if (
    !["product", "behind", "circle", "rounded"].includes(c.photo_mode) ||
    !["normal", "multiply"].includes(c.blend) ||
    !["fade", "slide", "none"].includes(c.transition) ||
    typeof c.frame_visible !== "boolean" ||
    typeof c.signature_visible !== "boolean"
  )
    return "Choisissez un mode de photo et une transition valides.";
  if (
    ![c.frame_color, c.background_color].every(
      (color) => typeof color === "string" && /^#[a-f0-9]{6}$/i.test(color),
    )
  )
    return "Choisissez des couleurs de cadre et de fond valides.";
  if (
    !Number.isInteger(c.frame_size) ||
    c.frame_size < 50 ||
    c.frame_size > 100 ||
    !Number.isInteger(c.frame_width) ||
    c.frame_width < 1 ||
    c.frame_width > 12 ||
    !Number.isInteger(c.duration_ms) ||
    c.duration_ms < 200 ||
    c.duration_ms > 1500
  )
    return "Vérifiez la taille du cadre (50 à 100 %), son épaisseur (1 à 12 px) et la transition (200 à 1500 ms).";
  for (const axis of [h.x, h.y])
    if (
      axis !== undefined &&
      (!Number.isFinite(axis) || axis < -50 || axis > 50)
    )
      return "La position de l’image doit rester entre −50 et 50.";
  if (h.fit !== undefined && !["contain", "cover"].includes(h.fit))
    return "Affichage de l’image invalide.";
  return null;
}
