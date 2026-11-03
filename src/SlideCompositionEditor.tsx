import { useState } from "react";
import { Image, Monitor, RotateCcw, Smartphone } from "lucide-react";
import type { Hero, SlideComposition } from "./types";
import { photoPreset, slideComposition } from "./slider";
import { SliderVisual } from "./SlideVisual";
import { Field } from "./ui";

export function SlideCompositionEditor({
  slide: h,
  onChange,
}: {
  slide: Hero;
  onChange: (h: Hero) => void;
}) {
  const c = slideComposition(h),
    [mobile, setMobile] = useState(false);
  const set = <K extends keyof SlideComposition>(
    key: K,
    value: SlideComposition[K],
  ) => onChange({ ...h, composition: { ...c, [key]: value } });
  const modes: Record<SlideComposition["photo_mode"], string> = {
    product:
      "Le produit est devant le disque décoratif. Convient aux images sur fond transparent ou blanc.",
    behind:
      "La photo remplit le panneau. Le cercle transparent passe devant comme un cadre, sans cacher la photo.",
    circle:
      "La photo reste dans le cercle. Son contour est placé devant l’image.",
    rounded:
      "La photo est contenue dans un cadre rectangulaire aux coins arrondis.",
  };
  return (
    <div className="slide-composition-editor">
      <div className="composition-preview-area">
        <div className="composition-preview-heading">
          <b>
            <Image size={16} />
            Aperçu photo et cadre
          </b>
          <div className="preview-device-buttons">
            <button
              type="button"
              aria-label="Aperçu ordinateur"
              aria-pressed={!mobile}
              onClick={() => setMobile(false)}
            >
              <Monitor size={17} />
            </button>
            <button
              type="button"
              aria-label="Aperçu téléphone"
              aria-pressed={mobile}
              onClick={() => setMobile(true)}
            >
              <Smartphone size={17} />
            </button>
          </div>
        </div>
        <div
          className={"slide-live-preview " + (mobile ? "preview-mobile" : "")}
        >
          <SliderVisual slide={h} animate={false} />
        </div>
        <p className="muted-copy">
          L’aperçu suit vos réglages. Le texte apparaît à gauche sur ordinateur
          et au-dessus de la photo sur téléphone.
        </p>
      </div>
      <div className="composition-fields">
        <h4>Choisir une présentation</h4>
        <div className="composition-presets">
          {(
            [
              ["product", "Produit"],
              ["behind", "Derrière le cercle"],
              ["circle", "Cadre rond"],
              ["rounded", "Cadre arrondi"],
              ["poster", "Affiche entière"],
            ] as const
          ).map(([key, title]) => (
            <button
              type="button"
              key={key}
              onClick={() => onChange(photoPreset(h, key))}
            >
              {title}
            </button>
          ))}
        </div>
        {h.layout !== "poster" ? (
          <>
            <Field label="Position de la photo par rapport au cadre">
              <select
                value={c.photo_mode}
                onChange={(e) =>
                  onChange(
                    photoPreset(
                      h,
                      e.target.value as SlideComposition["photo_mode"],
                    ),
                  )
                }
              >
                <option value="product">Produit devant le cercle</option>
                <option value="behind">Photo derrière le cercle</option>
                <option value="circle">Photo dans un cadre rond</option>
                <option value="rounded">Photo dans un cadre arrondi</option>
              </select>
            </Field>
            <p className="composition-hint">{modes[c.photo_mode]}</p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.frame_visible}
                onChange={(e) => set("frame_visible", e.target.checked)}
              />
              Afficher le cercle ou le contour décoratif
            </label>
            <div className="form-grid">
              <Field label={"Taille du cadre : " + c.frame_size + " %"}>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={c.frame_size}
                  onChange={(e) => set("frame_size", Number(e.target.value))}
                />
              </Field>
              <Field label={"Épaisseur du contour : " + c.frame_width + " px"}>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={c.frame_width}
                  onChange={(e) => set("frame_width", Number(e.target.value))}
                />
              </Field>
              <Field label="Couleur du contour">
                <input
                  type="color"
                  value={c.frame_color}
                  onChange={(e) => set("frame_color", e.target.value)}
                />
              </Field>
              <Field label="Couleur derrière la photo">
                <input
                  type="color"
                  value={c.background_color}
                  onChange={(e) => set("background_color", e.target.value)}
                />
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.blend === "multiply"}
                onChange={(e) =>
                  set("blend", e.target.checked ? "multiply" : "normal")
                }
              />
              Atténuer le fond blanc de l’image
            </label>
            <p className="composition-hint">
              Désactivez cette option pour garder les couleurs d’une photo
              d’ambiance.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.signature_visible}
                onChange={(e) => set("signature_visible", e.target.checked)}
              />
              Afficher la signature HOME DESIGN sur la photo
            </label>
          </>
        ) : (
          <p className="composition-hint">
            L’affiche utilise tout l’espace du visuel, sans cercle ni signature
            ajoutée. « Image entière » préserve le contenu de votre affiche.
          </p>
        )}
        <h4>Cadrage de l’image</h4>
        <div className="form-grid">
          <Field
            label={
              "Taille de l’image : " + Math.round((h.scale || 1) * 100) + " %"
            }
          >
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={h.scale || 1}
              onChange={(e) =>
                onChange({ ...h, scale: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Affichage de l’image">
            <select
              value={h.fit || "contain"}
              onChange={(e) =>
                onChange({ ...h, fit: e.target.value as Hero["fit"] })
              }
            >
              <option value="contain">Image entière</option>
              <option value="cover">Remplir et recadrer</option>
            </select>
          </Field>
          <Field label={"Position horizontale : " + (h.x || 0)}>
            <input
              type="range"
              min={-50}
              max={50}
              value={h.x || 0}
              onChange={(e) => onChange({ ...h, x: Number(e.target.value) })}
            />
          </Field>
          <Field label={"Position verticale : " + (h.y || 0)}>
            <input
              type="range"
              min={-50}
              max={50}
              value={h.y || 0}
              onChange={(e) => onChange({ ...h, y: Number(e.target.value) })}
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onChange({ ...h, scale: 1, x: 0, y: 0 })}
        >
          <RotateCcw size={16} />
          Recentrer l’image
        </button>
        <h4>Transition vers cette diapositive</h4>
        <Field label="Style de transition">
          <select
            value={c.transition}
            onChange={(e) =>
              set(
                "transition",
                e.target.value as SlideComposition["transition"],
              )
            }
          >
            <option value="fade">Fondu doux</option>
            <option value="slide">Glissement léger</option>
            <option value="none">Sans animation</option>
          </select>
        </Field>
        {c.transition !== "none" && (
          <Field
            label={
              "Durée de transition : " +
              (c.duration_ms / 1000).toLocaleString("fr-FR") +
              " s"
            }
          >
            <input
              type="range"
              min={200}
              max={1500}
              step={50}
              value={c.duration_ms}
              onChange={(e) => set("duration_ms", Number(e.target.value))}
            />
          </Field>
        )}
        <p className="composition-hint">
          Les images suivantes sont préparées à l’avance. Les visiteurs qui
          limitent les animations gardent une présentation sans mouvement.
        </p>
      </div>
    </div>
  );
}
