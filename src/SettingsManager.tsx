import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Grid2X2,
  Image,
  Layers,
  LockKeyhole,
  Palette,
  Phone,
  Save,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Video,
} from "lucide-react";
import type { Settings } from "./types";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import * as api from "./api";
import { AdvancedSettings } from "./CustomerFeatures";
import { FeatureSettings } from "./FeatureControls";
import { VisualSettings } from "./Experience";
import { AdminPasswordSettings } from "./ClientAccess";
import { CatalogTransfer } from "./CatalogTransfer";
import { ThemeSettings } from "./ThemeSettings";
import { mergeSettingsDraft } from "./settingsDraft";
import "./admin-settings.css";

const pages = [
  {
    id: "company",
    title: "Entreprise",
    help: "Nom, logo, adresse et couleurs de votre entreprise.",
    icon: Building2,
  },
  {
    id: "themes",
    title: "Thèmes",
    help: "Choisissez l’ambiance classique ou saisonnière du magasin.",
    icon: Palette,
  },
  {
    id: "home",
    title: "Diaporama d’accueil",
    help: "Images, textes et vitesse du diaporama principal.",
    icon: Image,
  },
  {
    id: "collections",
    title: "Collections",
    help: "Affichage des familles et leurs diaporamas.",
    icon: Layers,
  },
  {
    id: "products",
    title: "Affichage des produits",
    help: "Poids, matière, dimensions et informations visibles.",
    icon: Grid2X2,
  },
  {
    id: "prices",
    title: "Prix et accès",
    help: "Décidez qui peut consulter les tarifs du catalogue.",
    icon: LockKeyhole,
  },
  {
    id: "media",
    title: "Vidéos et YouTube",
    help: "Signature du site, chaîne YouTube et vidéos courtes.",
    icon: Video,
  },
  {
    id: "contacts",
    title: "Contacts et PDF",
    help: "WhatsApp, Viber, réseaux sociaux et catalogue PDF.",
    icon: Phone,
  },
  {
    id: "about",
    title: "Qui sommes-nous ?",
    help: "Présentez l’entreprise avec un texte et une photo.",
    icon: Building2,
  },
  {
    id: "orders",
    title: "Commandes",
    help: "Devise, colisage, livraison et informations fiscales.",
    icon: ShoppingBag,
  },
  {
    id: "requests",
    title: "Produits hors catalogue",
    help: "Conditions, quantités et photos des demandes de modèles absents.",
    icon: FileText,
  },
  {
    id: "seasons",
    title: "Saisons et sélections",
    help: "Programmez vos sélections et recommandations.",
    icon: CalendarDays,
  },
  {
    id: "policies",
    title: "Conditions et confidentialité",
    help: "Textes des conditions de commande et de confidentialité.",
    icon: FileText,
  },
  {
    id: "security",
    title: "Sécurité",
    help: "Modifiez le mot de passe du responsable.",
    icon: ShieldCheck,
  },
  {
    id: "updates",
    title: "Mise à jour",
    help: "Code protégé, Excel, poids et sauvegardes du catalogue.",
    icon: Upload,
  },
] as const;
type Page = "overview" | (typeof pages)[number]["id"];
const independent = (page: Page) => page === "security" || page === "updates";

export function SettingsManager() {
  const { catalog, notify, refresh } = useStore();
  const [s, setS] = useState<Settings>(() =>
    structuredClone(catalog!.settings),
  );
  const [saved, setSaved] = useState(() => JSON.stringify(catalog!.settings));
  const [page, setPage] = useState<Page>("overview");
  const [busy, setBusy] = useState(false);
  const formId = useId(),
    heading = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(s) !== saved;
  const selected = pages.find((item) => item.id === page);
  const choose = (next: Page) => {
    setPage(next);
    window.requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setS((current) => ({ ...current, [key]: value }));
  const edit =
    (...fields: (keyof Settings)[]) =>
    (next: Settings) =>
      setS((current) => mergeSettingsDraft(current, s, next, fields));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = event.currentTarget.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:invalid,select:invalid,textarea:invalid");
    if (invalid) {
      const target = invalid.closest<HTMLElement>("[data-settings-page]")
        ?.dataset.settingsPage as Page | undefined;
      if (target) choose(target);
      window.requestAnimationFrame(() => {
        let parent = invalid.parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
        invalid.focus();
        invalid.reportValidity();
      });
      return;
    }
    setBusy(true);
    const snapshot = structuredClone(s);
    try {
      await api.saveSettings(snapshot);
      await refresh();
      setSaved(JSON.stringify(snapshot));
      notify(
        api.previewMode
          ? "Réglages mis à jour dans l’aperçu."
          : "Réglages enregistrés.",
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const uploadSettingImage = async (file: File) => {
    setBusy(true);
    try {
      const image = await api.uploadProductImage(file);
      set("logo_url", image.url);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const panel = (id: Exclude<Page, "overview">, children: ReactNode) => (
    <div
      data-settings-page={id}
      className="settings-subpage"
      hidden={page !== id}
    >
      {children}
    </div>
  );
  return (
    <section className="settings-workspace">
      <div className="settings-workspace-title">
        <div>
          <span className="eyebrow">CONFIGURATION DU MAGASIN</span>
          <h2 ref={heading} tabIndex={-1}>
            {selected?.title || "Tous les réglages"}
          </h2>
          <p>
            {selected?.help ||
              "Choisissez une rubrique. Vos modifications restent conservées quand vous passez de l’une à l’autre."}
          </p>
        </div>
        <span
          className={"settings-draft-state " + (dirty ? "has-changes" : "")}
          role="status"
        >
          {dirty ? (
            <>
              <span /> Modifications non enregistrées
            </>
          ) : (
            <>
              <Check size={15} /> Réglages à jour
            </>
          )}
        </span>
      </div>
      <div className="settings-workspace-layout">
        <nav
          className="settings-section-nav"
          aria-label="Rubriques des réglages"
        >
          <button
            type="button"
            aria-current={page === "overview" ? "page" : undefined}
            onClick={() => choose("overview")}
          >
            <Settings2 size={17} /> Tous les réglages
          </button>
          {pages.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? "page" : undefined}
              onClick={() => choose(id)}
            >
              <Icon size={17} /> {title}
            </button>
          ))}
        </nav>
        <div className="settings-workspace-content">
          <label className="settings-mobile-selector">
            Rubrique
            <select
              value={page}
              onChange={(event) => choose(event.target.value as Page)}
            >
              <option value="overview">Tous les réglages</option>
              {pages.map(({ id, title }) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          {page !== "overview" && (
            <button
              className="settings-back"
              type="button"
              onClick={() => choose("overview")}
            >
              <ArrowLeft size={16} /> Tous les réglages
            </button>
          )}
          <div className="settings-section-hub" hidden={page !== "overview"}>
            {pages.map(({ id, title, help, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => choose(id)}
                className="settings-section-card"
              >
                <span className="settings-section-icon">
                  <Icon size={22} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{help}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          <form
            id={formId}
            noValidate
            onSubmit={(event) => void save(event)}
            className="settings-form settings-draft-form"
            autoComplete="off"
            hidden={page === "overview" || independent(page)}
          >
            {panel(
              "company",
              <section className="panel">
                <h2>Les informations de l’entreprise</h2>
                <div className="form-grid">
                  <Field label="Nom de l’entreprise *">
                    <input
                      required
                      value={s.company_name}
                      maxLength={150}
                      onChange={(e) => set("company_name", e.target.value)}
                    />
                  </Field>
                  <Field label="Nom français / signature">
                    <input
                      value={s.company_name_fr}
                      maxLength={150}
                      onChange={(e) => set("company_name_fr", e.target.value)}
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      maxLength={40}
                      value={s.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </Field>
                  <Field label="E-mail">
                    <input
                      type="email"
                      maxLength={254}
                      value={s.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Adresse de l’entreprise">
                  <textarea
                    rows={2}
                    value={s.address}
                    maxLength={500}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
                <Field label="Logo officiel">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadSettingImage(f);
                    }}
                  />
                </Field>
                <img
                  className="settings-logo-preview"
                  src={s.logo_url}
                  alt="Logo configuré"
                />
                <div className="form-grid">
                  <Field label="Couleur principale">
                    <input
                      type="color"
                      value={s.primary_color}
                      onChange={(e) => set("primary_color", e.target.value)}
                    />
                  </Field>
                  <Field label="Couleur d’accent">
                    <input
                      type="color"
                      value={s.accent_color}
                      onChange={(e) => set("accent_color", e.target.value)}
                    />
                  </Field>
                </div>
              </section>,
            )}
            {panel(
              "themes",
              <ThemeSettings
                settings={s}
                onChange={edit("storefront_theme")}
              />,
            )}
            {panel(
              "home",
              <VisualSettings
                section="home"
                s={s}
                onChange={edit(
                  "heroes",
                  "home_slider_height",
                  "slider_interval",
                )}
              />,
            )}
            {panel(
              "collections",
              <FeatureSettings
                section="families"
                s={s}
                onChange={edit("family_options")}
              />,
            )}
            {panel(
              "products",
              <FeatureSettings
                section="products"
                s={s}
                onChange={edit("product_display")}
              />,
            )}
            {panel(
              "prices",
              <AdvancedSettings
                section="prices"
                s={s}
                onChange={edit("price_visibility")}
              />,
            )}
            {panel(
              "media",
              <AdvancedSettings
                section="media"
                s={s}
                onChange={edit(
                  "topbar_tagline",
                  "youtube_url",
                  "videos_enabled",
                  "videos_title",
                  "videos",
                )}
              />,
            )}
            {panel(
              "contacts",
              <AdvancedSettings
                section="contacts"
                s={s}
                onChange={edit(
                  "secondary_phone",
                  "whatsapp_phone",
                  "viber_phone",
                  "website_url",
                  "facebook_url",
                  "catalog_pdf_url",
                  "catalog_pdf_title",
                )}
              />,
            )}
            {panel(
              "about",
              <VisualSettings
                section="about"
                s={s}
                onChange={edit("about_title", "about_body", "about_image")}
              />,
            )}
            {panel(
              "orders",
              <section className="panel">
                <h2>Commandes, devise et fuseau horaire</h2>
                <div className="form-grid">
                  <Field label="Devise (code ISO)">
                    <input
                      required
                      pattern="[A-Z]{3}"
                      maxLength={3}
                      value={s.currency}
                      onChange={(e) =>
                        set("currency", e.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <Field label="Nom du colis par défaut">
                    <input
                      required
                      maxLength={30}
                      value={s.pack_label}
                      onChange={(e) => set("pack_label", e.target.value)}
                    />
                  </Field>
                  <Field label="Supplément de livraison">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      max={1000000}
                      value={s.shipping_cents / 100}
                      onChange={(e) =>
                        set(
                          "shipping_cents",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </Field>
                  <Field label="Fuseau IANA (promotions et dates)">
                    <input
                      required
                      value={s.timezone}
                      onChange={(e) => set("timezone", e.target.value)}
                      placeholder="Africa/Algiers"
                    />
                  </Field>
                </div>
                <Field label="Mention fiscale / affichage des prix">
                  <textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={s.tax_note}
                    onChange={(e) => set("tax_note", e.target.value)}
                  />
                </Field>
                <p className="muted-copy">
                  Les anciens bons conservent leur devise, frais et informations
                  d’entreprise. Aucun paiement électronique n’est activé.
                </p>
              </section>,
            )}
            {panel(
              "requests",
              <FeatureSettings
                section="requests"
                s={s}
                onChange={edit("custom_order")}
              />,
            )}
            {panel(
              "seasons",
              <AdvancedSettings
                section="seasons"
                s={s}
                onChange={edit("seasons", "recommendation_mode")}
              />,
            )}
            {panel(
              "policies",
              <section className="panel">
                <h2>Informations et politiques</h2>
                <Field label="Politique de confidentialité">
                  <textarea
                    rows={5}
                    maxLength={10000}
                    value={s.privacy}
                    onChange={(e) => set("privacy", e.target.value)}
                  />
                </Field>
                <Field label="Conditions de commande">
                  <textarea
                    rows={5}
                    maxLength={10000}
                    value={s.terms}
                    onChange={(e) => set("terms", e.target.value)}
                  />
                </Field>
              </section>,
            )}
          </form>
          {panel(
            "collections",
            <>
              <p className="settings-independent-help">
                Le diaporama de chaque collection possède son propre bouton
                d’enregistrement.
              </p>
              <VisualSettings section="families" s={s} onChange={() => {}} />
            </>,
          )}
          {panel("security", <AdminPasswordSettings />)}
          {panel("updates", <CatalogTransfer />)}
          {(dirty || (page !== "overview" && !independent(page))) && (
            <div className="settings-workspace-save">
              <span>
                {dirty
                  ? "Enregistrez pour publier vos modifications."
                  : "Vos réglages sont enregistrés."}
              </span>
              <button
                form={formId}
                type="submit"
                className="btn btn-primary"
                disabled={busy || !dirty}
              >
                {busy ? <Spinner /> : <Save size={17} />} Enregistrer les
                réglages
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
