import { useEffect, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { CustomOrderOptions } from "./types";
import { Field } from "./ui";
import { useStore } from "./store";
import { imageLimitMo } from "./localApi";

export interface CustomArticleDraft {
  id: string;
  name: string;
  quantity_units: number;
  files: File[];
}
export const blankArticle = (): CustomArticleDraft => ({
  id: crypto.randomUUID(),
  name: "",
  quantity_units: 1,
  files: [],
});
function Photos({ files }: { files: File[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const values = files.map((f) => URL.createObjectURL(f));
    setUrls(values);
    return () => values.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return (
    <div className="custom-article-photos">
      {urls.map((url, i) => (
        <img key={url} src={url} alt={"Photo de référence " + (i + 1)} />
      ))}
    </div>
  );
}
export function CustomArticles({
  value,
  onChange,
  options,
}: {
  value: CustomArticleDraft[];
  onChange: (items: CustomArticleDraft[]) => void;
  options: CustomOrderOptions;
}) {
  const { notify } = useStore();
  const update = (id: string, patch: Partial<CustomArticleDraft>) =>
    onChange(value.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div className="custom-articles">
      <p className="muted-copy">
        Indiquez le nom et le nombre de pièces de chaque article. Ajoutez des
        photos pour présenter votre idée.
      </p>
      {value.map((item, index) => (
        <section className="custom-article" key={item.id}>
          <div className="custom-article-heading">
            <h3>Article {String(index + 1).padStart(2, "0")}</h3>
            {value.length > 1 && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label={"Retirer l’article " + (index + 1)}
                onClick={() => onChange(value.filter((i) => i.id !== item.id))}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          <Field label="Nom du produit souhaité *">
            <input
              required
              maxLength={150}
              value={item.name}
              onChange={(e) => update(item.id, { name: e.target.value })}
              placeholder="Ex. Boîte avec couvercle"
            />
          </Field>
          <Field label="Quantité demandée (pièces) *">
            <input
              type="number"
              required
              min={
                options.minimum_scope === "per_item"
                  ? Math.max(1, options.min_units)
                  : 1
              }
              max={10000000}
              step={1}
              value={item.quantity_units || ""}
              onChange={(e) =>
                update(item.id, { quantity_units: Number(e.target.value) })
              }
            />
          </Field>
          <Photos files={item.files} />
          <label className="custom-photo-input">
            <ImagePlus size={22} />
            <span>
              <b>
                {item.files.length
                  ? "Remplacer les photos"
                  : "Ajouter des photos"}
                {options.require_photo ? " *" : ""}
              </b>
              <small>
                JPG, PNG ou WebP · 2 photos · {imageLimitMo} Mo par photo
              </small>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required={options.require_photo && !item.files.length}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (
                  files.length > 2 ||
                  files.some((f) => f.size > imageLimitMo * 1024 * 1024)
                ) {
                  notify(
                    `2 photos maximum, ${imageLimitMo} Mo par photo.`,
                    true,
                  );
                  e.target.value = "";
                  return;
                }
                update(item.id, { files });
              }}
            />
          </label>
          {item.files.map((file, i) => (
            <div key={i} className="attachment-name">
              {file.name}
              <button
                type="button"
                aria-label={
                  "Retirer la photo " + (i + 1) + " de l’article " + (index + 1)
                }
                onClick={() =>
                  update(item.id, {
                    files: item.files.filter((_, n) => n !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </section>
      ))}
      {value.length < options.max_items && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onChange([...value, blankArticle()])}
        >
          <Plus size={17} />
          Ajouter un article
        </button>
      )}
      <div className="custom-quantity-total">
        <span>Quantité totale</span>
        <b>
          {value
            .reduce((sum, i) => sum + i.quantity_units, 0)
            .toLocaleString("fr-FR")}{" "}
          pièces
        </b>
      </div>
    </div>
  );
}
