import { ArrowRight, Layers, Sparkles } from "lucide-react";
import type {
  Family,
  Settings,
  ProductDisplay,
  FamilyOptions,
  CustomOrderOptions,
} from "./types";
import {
  customOrderOptions,
  familyOptions,
  matchesFamily,
  productDisplay,
} from "./domain";
import { useStore } from "./store";
import { Field } from "./ui";
import { Slider, familySlides, SlideEditor } from "./Experience";

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <label className="feature-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <b>{label}</b>
        <small>{help}</small>
      </span>
    </label>
  );
}
export function FeatureSettings({
  s,
  onChange,
}: {
  s: Settings;
  onChange: (s: Settings) => void;
}) {
  const d = productDisplay(s),
    c = customOrderOptions(s),
    f = familyOptions(s);
  const display = (key: keyof ProductDisplay, value: boolean) =>
    onChange({ ...s, product_display: { ...d, [key]: value } });
  const custom = <K extends keyof CustomOrderOptions>(
    key: K,
    value: CustomOrderOptions[K],
  ) => onChange({ ...s, custom_order: { ...c, [key]: value } });
  const family = (key: keyof FamilyOptions, value: boolean) =>
    onChange({ ...s, family_options: { ...f, [key]: value } });
  return (
    <>
      <section className="panel feature-settings">
        <h2>Informations visibles sur les produits</h2>
        <p className="muted-copy">
          Choisissez les informations que les visiteurs peuvent voir. Les
          valeurs saisies restent enregistrées lorsque vous les masquez.
        </p>
        <div className="feature-toggle-grid">
          {(
            [
              [
                "weight",
                "Poids en grammes",
                "Affiche le poids unitaire dans la fiche produit.",
              ],
              [
                "material",
                "Matière",
                "Affiche la matière que vous avez renseignée.",
              ],
              [
                "dimensions",
                "Dimensions",
                "Affiche longueur, largeur et hauteur.",
              ],
              [
                "capacity",
                "Capacité",
                "Affiche le volume, par exemple en litres.",
              ],
              [
                "barcode",
                "Code-barres",
                "Affiche le numéro dans la fiche ; la recherche par code reste disponible.",
              ],
              [
                "pack",
                "Colisage",
                "Affiche le détail du colisage. Les quantités du panier restent exprimées en cartons.",
              ],
              [
                "availability",
                "Badge de disponibilité",
                "Affiche le badge de stock. Un produit indisponible reste signalé et ne peut pas être commandé.",
              ],
              [
                "description",
                "Description",
                "Affiche votre texte de présentation du produit.",
              ],
              [
                "new_badge",
                "Badge NOUVEAU",
                "Met les nouveautés en évidence sur les photos. Leur collection reste accessible.",
              ],
              [
                "related_products",
                "Produits de la même famille",
                "Propose d’autres références sous la fiche complète.",
              ],
              [
                "hide_empty",
                "Masquer les champs vides",
                "Évite les lignes « Non renseigné » tant que les informations ne sont pas complétées.",
              ],
            ] as [keyof ProductDisplay, string, string][]
          ).map(([key, label, help]) => (
            <Toggle
              key={key}
              checked={d[key]}
              onChange={(v) => display(key, v)}
              label={label}
              help={help}
            />
          ))}
        </div>
      </section>
      <section className="panel feature-settings">
        <h2>Fabrication sur mesure</h2>
        <Toggle
          checked={c.enabled}
          onChange={(v) => custom("enabled", v)}
          label="Ouvrir les demandes sur mesure"
          help="Affiche le formulaire et ses liens dans le magasin. Vous pouvez préparer les conditions avant l’ouverture."
        />
        <Field label="Conditions présentées au client">
          <textarea
            rows={5}
            maxLength={10000}
            value={c.terms}
            onChange={(e) => custom("terms", e.target.value)}
            placeholder="Écrivez vos conditions, délais indicatifs et consignes pour les photos…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Quantité minimum (pièces)">
            <input
              type="number"
              min={0}
              max={10000000}
              step={1}
              value={c.min_units}
              onChange={(e) => custom("min_units", Number(e.target.value))}
            />
          </Field>
          <Field label="Application du minimum">
            <select
              value={c.minimum_scope}
              onChange={(e) =>
                custom(
                  "minimum_scope",
                  e.target.value as CustomOrderOptions["minimum_scope"],
                )
              }
            >
              <option value="per_item">Pour chaque article</option>
              <option value="total">Pour l’ensemble de la demande</option>
            </select>
          </Field>
          <Field label="Articles maximum par demande">
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={c.max_items}
              onChange={(e) => custom("max_items", Number(e.target.value))}
            />
          </Field>
        </div>
        <p className="muted-copy">
          0 signifie aucun minimum imposé. Exemple : saisissez 1000 pour exiger
          au moins 1 000 pièces. Ce minimum est vérifié lors de l’envoi.
        </p>
        <Toggle
          checked={c.require_photo}
          onChange={(v) => custom("require_photo", v)}
          label="Photo obligatoire pour chaque article"
          help="Le client joint jusqu’à deux photos par article. Elles restent privées."
        />
        <Toggle
          checked={c.require_acceptance}
          onChange={(v) => custom("require_acceptance", v)}
          label="Faire accepter les conditions"
          help="Si des conditions sont écrites, le client doit les accepter. Leur version est conservée avec sa demande."
        />
      </section>
      <section className="panel feature-settings">
        <h2>Présentation des familles</h2>
        <p className="muted-copy">
          Les images et textes de chaque famille se préparent dans Collections →
          Modifier.
        </p>
        {(
          [
            [
              "slider",
              "Diaporamas des familles",
              "Affiche les diapositives, avec vitesse et lecture automatique réglables par famille.",
            ],
            [
              "introduction",
              "Présentation de la famille",
              "Affiche le texte de présentation sous le diaporama.",
            ],
            [
              "promotions",
              "Visuels publicitaires",
              "Affiche les encarts préparés pour chaque famille, avec un lien produit facultatif.",
            ],
            [
              "quick_navigation",
              "Navigation entre les familles",
              "Ajoute une barre de raccourcis pour parcourir les collections sur téléphone.",
            ],
            [
              "custom_link",
              "Invitation à un projet sur mesure",
              "Affiche un lien vers le formulaire lorsque les demandes sont ouvertes.",
            ],
          ] as [keyof FamilyOptions, string, string][]
        ).map(([key, label, help]) => (
          <Toggle
            key={key}
            checked={f[key]}
            onChange={(v) => family(key, v)}
            label={label}
            help={help}
          />
        ))}
      </section>
    </>
  );
}
export function FamilyExtrasEditor({
  family: f,
  onChange,
}: {
  family: Family;
  onChange: (f: Family) => void;
}) {
  return (
    <div className="family-extras-editor">
      {f.kind === "new" && (
        <p className="notice">
          Cette collection réunit automatiquement les produits cochés « Nouveau
          produit ». Gardez leur famille principale lors de la saisie.
        </p>
      )}
      <Field label="Présentation de cette famille">
        <textarea
          rows={3}
          value={f.introduction || ""}
          maxLength={1500}
          onChange={(e) => onChange({ ...f, introduction: e.target.value })}
        />
      </Field>
      <Toggle
        checked={f.slider_enabled !== false}
        onChange={(v) => onChange({ ...f, slider_enabled: v })}
        label="Afficher son diaporama"
        help="Ce choix concerne uniquement cette famille."
      />
      <Toggle
        checked={f.slider_autoplay !== false}
        onChange={(v) => onChange({ ...f, slider_autoplay: v })}
        label="Défilement automatique"
        help="Les visiteurs peuvent aussi utiliser les flèches, les points ou le geste de glissement."
      />
      <Field label="Secondes entre les diapositives">
        <input
          type="number"
          min={3}
          max={20}
          step={1}
          value={f.slider_interval || 6}
          onChange={(e) =>
            onChange({ ...f, slider_interval: Number(e.target.value) })
          }
        />
      </Field>
      <h3>Visuels publicitaires de la famille</h3>
      <p className="muted-copy">
        Ajoutez une affiche complète ou une image accompagnée de texte.
        Choisissez « Image entière » pour conserver tous les éléments d’une
        affiche. Chaque encart peut ouvrir un produit.
      </p>
      <SlideEditor
        slides={f.promotions || []}
        onChange={(promotions) => onChange({ ...f, promotions })}
        familyId={f.id}
        height={380}
        onHeight={() => {}}
        promotion
      />
    </div>
  );
}
export function FamilyLanding({ family: f }: { family: Family }) {
  const { catalog, now, openProduct } = useStore();
  if (!catalog) return null;
  const options = familyOptions(catalog.settings),
    ads = (f.promotions || []).filter((h) => h.visible);
  const available = catalog.products.filter((p) =>
    catalog.families.some((c) => c.id === p.family_id && c.visible),
  );
  const count = available.filter((p) => matchesFamily(p, f, now)).length;
  return (
    <div className="family-landing">
      {options.quick_navigation && (
        <nav className="family-quick-nav" aria-label="Parcourir les familles">
          {catalog.families
            .filter((c) => c.visible)
            .map((c) => (
              <a
                key={c.id}
                className={c.id === f.id ? "selected" : ""}
                aria-current={c.id === f.id ? "page" : undefined}
                href={"#/catalogue?famille=" + c.id}
              >
                {c.kind === "new" && <Sparkles size={15} />}
                {c.name}
              </a>
            ))}
        </nav>
      )}
      {options.slider && f.slider_enabled !== false && (
        <Slider
          key={f.id}
          compact
          slides={familySlides(f)}
          height={f.slider_height || 380}
          interval={f.slider_interval || catalog.settings.slider_interval}
          autoplay={f.slider_autoplay !== false}
        />
      )}
      {options.introduction && f.introduction && (
        <div className="family-introduction">
          <span className="family-intro-icon">
            {f.kind === "new" ? <Sparkles size={28} /> : <Layers size={28} />}
          </span>
          <div>
            <span className="eyebrow">{count} RÉFÉRENCES À DÉCOUVRIR</span>
            <h2>{f.name}</h2>
            <p>{f.introduction}</p>
          </div>
        </div>
      )}
      {options.promotions && !!ads.length && (
        <div className="family-promotion-grid">
          {ads.map((h) => (
            <article
              className={
                "family-promotion " +
                (h.layout === "poster" ? "promotion-poster" : "")
              }
              key={h.id}
            >
              {h.image && (
                <img
                  src={h.image}
                  alt={h.title}
                  loading="lazy"
                  style={{
                    objectFit: h.fit || "contain",
                    objectPosition: `${50 + (h.x || 0)}% ${50 + (h.y || 0)}%`,
                    transform: `scale(${h.scale || 1})`,
                  }}
                />
              )}
              <div className="family-promotion-copy">
                <span className="eyebrow">{h.eyebrow}</span>
                <h3>{h.title}</h3>
                {h.body && <p>{h.body}</p>}
                <button
                  className="btn btn-outline"
                  onClick={() =>
                    h.product_id
                      ? openProduct(h.product_id)
                      : document
                          .getElementById("collection-products")
                          ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {h.cta || "Découvrir"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {options.custom_link && customOrderOptions(catalog.settings).enabled && (
        <a className="family-custom-link" href="#/sur-mesure">
          <span>
            Un format ou une idée particulière ?{" "}
            <b>Présentez votre projet sur mesure.</b>
          </span>
          <ArrowRight size={21} />
        </a>
      )}
    </div>
  );
}
