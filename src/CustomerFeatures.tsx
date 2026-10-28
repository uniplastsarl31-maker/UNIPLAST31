import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  FileDown,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { CustomerAccess, Settings, Season } from "./types";
import * as api from "./api";
import { pdfLimitMo } from "./localApi";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import { normalizeSearch, safeWebUrl } from "./domain";

export { CustomerAccount, CustomerAccessManager } from "./ClientAccess";

export function AdvancedSettings({
  s,
  onChange,
}: {
  s: Settings;
  onChange: (s: Settings) => void;
}) {
  const { catalog, notify } = useStore();
  const [uploading, setUploading] = useState(false),
    [query, setQuery] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...s, [k]: v });
  const changeSeason = (id: string, patch: Partial<Season>) =>
    set(
      "seasons",
      s.seasons.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  const add = (title: string) =>
    set("seasons", [
      ...s.seasons,
      {
        id: crypto.randomUUID(),
        title,
        description:
          title === "Ramadan"
            ? "Des solutions pour préparer, conserver et partager."
            : title === "Été"
              ? "Les essentiels pour les sorties et les journées d’été."
              : "",
        starts_on: "",
        ends_on: "",
        visible: true,
        product_ids: [],
        family_ids:
          catalog?.families
            .filter((f) =>
              (title === "Ramadan"
                ? [
                    "Emballages alimentaires",
                    "Boîtes de conservation",
                    "Céréales & épices",
                    "Vaisselle & service",
                  ]
                : title === "Été"
                  ? [
                      "Glacières & gourdes",
                      "Repas & pique-nique",
                      "Pots & jardin",
                    ]
                  : []
              ).includes(f.name),
            )
            .map((f) => f.id) || [],
      },
    ]);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      set("catalog_pdf_url", await api.uploadCompanyCatalog(file));
      notify("PDF prêt. Enregistrez les réglages pour le publier.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setUploading(false);
    }
  };
  const selectedUrl =
    safeWebUrl(s.catalog_pdf_url) ||
    (api.previewMode && s.catalog_pdf_url.startsWith("blob:")
      ? s.catalog_pdf_url
      : "");
  return (
    <>
      <section className="panel">
        <h2>
          <LockKeyhole size={21} /> Visibilité des prix
        </h2>
        <Field label="Qui peut consulter les tarifs ?">
          <select
            value={s.price_visibility}
            onChange={(e) =>
              set(
                "price_visibility",
                e.target.value as Settings["price_visibility"],
              )
            }
          >
            <option value="public">Tout le monde</option>
            <option value="approved">
              Uniquement les clients agréés et l’administrateur
            </option>
          </select>
        </Field>
        <p>
          En mode réservé, les visiteurs consultent les produits. La
          consultation des prix et la commande nécessitent le téléphone et le
          code remis par UNIPLAST. Les documents déjà créés restent privés pour
          leur propriétaire.
        </p>
        <a className="text-link" href="#/client-agree">
          Voir l’espace Client agréé →
        </a>
        <div className="notice amber">
          Les catalogues PDF sont publics : publiez une version sans prix si
          vous réservez vos tarifs aux clients agréés. Les tarifs déjà
          communiqués ne peuvent pas être retirés des copies téléchargées.
        </div>
      </section>
      <section className="panel">
        <h2>Contacts, liens et catalogue PDF</h2>
        <div className="form-grid">
          <Field label="Deuxième téléphone">
            <input
              type="tel"
              maxLength={40}
              value={s.secondary_phone}
              onChange={(e) => set("secondary_phone", e.target.value)}
            />
          </Field>
          <Field label="WhatsApp de l’entreprise (format international)">
            <input
              type="tel"
              placeholder="+213…"
              maxLength={40}
              value={s.whatsapp_phone}
              onChange={(e) => set("whatsapp_phone", e.target.value)}
            />
          </Field>
          <Field label="Site internet (HTTPS)">
            <input
              type="url"
              value={s.website_url}
              onChange={(e) => set("website_url", e.target.value)}
            />
          </Field>
          <Field label="Page Facebook (HTTPS)">
            <input
              type="url"
              value={s.facebook_url}
              onChange={(e) => set("facebook_url", e.target.value)}
            />
          </Field>
          <Field label="Titre du catalogue">
            <input
              required
              maxLength={150}
              value={s.catalog_pdf_title}
              onChange={(e) => set("catalog_pdf_title", e.target.value)}
            />
          </Field>
          <Field
            label={`Importer le catalogue public (PDF, ${pdfLimitMo} Mo maximum)`}
          >
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </Field>
        </div>
        {uploading && (
          <p>
            <Spinner /> Envoi du document…
          </p>
        )}
        {selectedUrl && (
          <div className="feature-actions">
            <a
              className="btn btn-outline"
              href={selectedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileDown size={17} /> Ouvrir le catalogue
            </a>
            <button
              type="button"
              className="text-link"
              onClick={() => set("catalog_pdf_url", "")}
            >
              Retirer le lien public
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>
          <CalendarDays size={21} /> Saisons et recommandations
        </h2>
        <Field label="Priorité des recommandations">
          <select
            value={s.recommendation_mode}
            onChange={(e) =>
              set(
                "recommendation_mode",
                e.target.value as Settings["recommendation_mode"],
              )
            }
          >
            <option value="balanced">
              Sélection équilibrée : priorités, disponibilité, ventes
            </option>
            <option value="sales">
              D’abord les meilleures ventes confirmées
            </option>
          </select>
        </Field>
        <p>
          Programmez vos sélections à l’avance : elles apparaissent
          automatiquement entre les dates indiquées, dans le fuseau de la
          boutique. Choisissez chaque année les dates de Ramadan selon votre
          calendrier.
        </p>
        <div className="feature-actions">
          {["Ramadan", "Été", "Nouvelle sélection"].map((t) => (
            <button
              type="button"
              key={t}
              className="btn btn-outline"
              disabled={s.seasons.length >= 20}
              onClick={() => add(t)}
            >
              <Plus size={16} /> {t}
            </button>
          ))}
        </div>
        {s.seasons.map((c) => (
          <div className="season-editor" key={c.id}>
            <div className="panel-heading">
              <h3>{c.title || "Sélection"}</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label={"Supprimer " + c.title}
                onClick={() =>
                  set(
                    "seasons",
                    s.seasons.filter((x) => x.id !== c.id),
                  )
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="form-grid">
              <Field label="Titre">
                <input
                  required
                  maxLength={150}
                  value={c.title}
                  onChange={(e) =>
                    changeSeason(c.id, { title: e.target.value })
                  }
                />
              </Field>
              <Field label="Description">
                <input
                  maxLength={500}
                  value={c.description}
                  onChange={(e) =>
                    changeSeason(c.id, { description: e.target.value })
                  }
                />
              </Field>
              <Field label="Du (inclus)">
                <input
                  required
                  type="date"
                  value={c.starts_on}
                  onChange={(e) =>
                    changeSeason(c.id, { starts_on: e.target.value })
                  }
                />
              </Field>
              <Field label="Au (inclus)">
                <input
                  required
                  type="date"
                  min={c.starts_on}
                  value={c.ends_on}
                  onChange={(e) =>
                    changeSeason(c.id, { ends_on: e.target.value })
                  }
                />
              </Field>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={c.visible}
                onChange={(e) =>
                  changeSeason(c.id, { visible: e.target.checked })
                }
              />{" "}
              Sélection activée
            </label>
            <h4>Choisir des collections</h4>
            <div className="season-choices">
              {catalog?.families.map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={c.family_ids.includes(f.id)}
                    onChange={(e) =>
                      changeSeason(c.id, {
                        family_ids: e.target.checked
                          ? [...c.family_ids, f.id]
                          : c.family_ids.filter((id) => id !== f.id),
                      })
                    }
                  />
                  {f.name}
                </label>
              ))}
            </div>
            <Field label="Ou rechercher un produit précis">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom ou référence…"
              />
            </Field>
            <div className="season-choices">
              {catalog?.products
                .filter(
                  (p) =>
                    c.product_ids.includes(p.id) ||
                    (query.length > 1 &&
                      normalizeSearch(p.name + " " + p.code).includes(
                        normalizeSearch(query),
                      )),
                )
                .slice(0, 30)
                .map((p) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={c.product_ids.includes(p.id)}
                      onChange={(e) =>
                        changeSeason(c.id, {
                          product_ids: e.target.checked
                            ? [...c.product_ids, p.id]
                            : c.product_ids.filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.code} · {p.name}
                  </label>
                ))}
            </div>
            <small>
              {c.family_ids.length} collection(s), {c.product_ids.length}{" "}
              produit(s) choisis. Aucune remise n’est créée automatiquement.
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
