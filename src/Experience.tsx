import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Pause,
  Play,
  Plus,
  Trash2,
  MessageCircle,
  ShieldCheck,
  Package,
  Factory,
} from "lucide-react";
import type { Family, Hero, Settings } from "./types";
import { useStore } from "./store";
import { Field, Spinner } from "./ui";
import * as api from "./api";

export function familySlides(f: Family): Hero[] {
  return f.slides?.length
    ? f.slides
    : [
        {
          id: f.id + "-intro",
          eyebrow: "LA COLLECTION UNIPLAST",
          title: f.name,
          body: "Des formats pratiques pour répondre à vos besoins. Explorez les références et trouvez votre solution.",
          image: f.image,
          cta: "Découvrir les produits",
          family_id: f.id,
          visible: true,
        },
        {
          id: f.id + "-service",
          eyebrow: "VOTRE BESOIN, NOTRE POINT DE DÉPART",
          title: f.name + "\nÀ vous de choisir.",
          body: "Comparez les formats, le colisage et les caractéristiques de cette collection.",
          image: f.image,
          cta: "Voir les références",
          family_id: f.id,
          visible: true,
        },
      ];
}
export function Slider({
  slides,
  height = 520,
  interval = 6,
  compact = false,
}: {
  slides: Hero[];
  height?: number;
  interval?: number;
  compact?: boolean;
}) {
  const visible = slides.filter((h) => h.visible),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [reduced, setReduced] = useState(false),
    start = useRef(0);
  const signature = visible.map((h) => h.id).join("|");
  useEffect(() => {
    setIndex(0);
  }, [signature]);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(q.matches);
    change();
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (paused || hover || reduced || visible.length < 2) return;
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible")
          setIndex((i) => (i + 1) % visible.length);
      },
      Math.max(3, interval) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [paused, hover, reduced, visible.length, interval, signature]);
  if (!visible.length) return null;
  const slide = visible[index % visible.length];
  const advance = (n: number) =>
    setIndex((i) => (i + n + visible.length) % visible.length);
  return (
    <section
      className={"brand-slider " + (compact ? "family-slider" : "")}
      style={
        {
          "--slider-height": Math.max(260, Math.min(760, height)) + "px",
        } as CSSProperties
      }
      aria-label={
        compact ? "Présentation de la collection" : "Présentation UNIPLAST"
      }
      aria-roledescription="carrousel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(false);
      }}
      onTouchStart={(e) => {
        start.current = e.changedTouches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const delta = e.changedTouches[0].clientX - start.current;
        if (Math.abs(delta) > 60) advance(delta > 0 ? -1 : 1);
      }}
    >
      <div className="slider-copy" key={slide.id + "-text"}>
        <span className="eyebrow">
          <i />
          {slide.eyebrow || "UNIPLAST · HOME DESIGN"}
        </span>
        {compact ? <h2>{slide.title}</h2> : <h1>{slide.title}</h1>}
        <p>{slide.body}</p>
        <a
          className="btn btn-primary"
          href={
            compact
              ? "#collection-products"
              : slide.family_id
                ? "#/catalogue?famille=" + slide.family_id
                : "#/catalogue"
          }
          onClick={(e) => {
            if (compact) {
              e.preventDefault();
              document
                .getElementById("collection-products")
                ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
            }
          }}
        >
          {slide.cta || "Explorer la collection"}
          <ArrowRight size={20} />
        </a>
        <div className="slider-caption">
          <span>UNIPLAST</span>
          <b>Le sens du pratique.</b>
        </div>
      </div>
      <div className="slider-visual" key={slide.id + "-image"}>
        <div className="slider-disc" />
        {slide.image ? (
          <img
            src={slide.image}
            alt={slide.title.replace(/\n/g, " ")}
            fetchPriority={compact ? "auto" : "high"}
            style={{
              objectFit: slide.fit || "contain",
              objectPosition: `${50 + (slide.x || 0)}% ${50 + (slide.y || 0)}%`,
              transform: `scale(${slide.scale || 1})`,
            }}
          />
        ) : (
          <div className="slider-family-placeholder">
            <Layers size={100} strokeWidth={0.8} />
            <span>{slide.title}</span>
          </div>
        )}
        <span className="slider-seal">
          HOME
          <br />
          <strong>DESIGN.</strong>
        </span>
      </div>
      {visible.length > 1 && (
        <div className="slider-controls">
          <span className="slider-counter">
            {String((index % visible.length) + 1).padStart(2, "0")} <i />{" "}
            {String(visible.length).padStart(2, "0")}
          </span>
          <div className="slider-dots">
            {visible.map((h, i) => (
              <button
                type="button"
                key={h.id}
                aria-label={"Afficher la diapositive " + (i + 1)}
                aria-current={index % visible.length === i ? "true" : undefined}
                className={index % visible.length === i ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label={
              paused ? "Lancer le diaporama" : "Mettre le diaporama en pause"
            }
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Diapositive précédente"
            onClick={() => advance(-1)}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Diapositive suivante"
            onClick={() => advance(1)}
          >
            <ArrowRight size={19} />
          </button>
        </div>
      )}
    </section>
  );
}
export function SlideEditor({
  slides,
  onChange,
  familyId = "",
  height,
  onHeight,
}: {
  slides: Hero[];
  onChange: (s: Hero[]) => void;
  familyId?: string;
  height: number;
  onHeight: (h: number) => void;
}) {
  const { catalog, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const change = (i: number, patch: Partial<Hero>) =>
    onChange(slides.map((h, n) => (n === i ? { ...h, ...patch } : h)));
  async function upload(i: number, file: File) {
    setBusy(true);
    try {
      const im = await api.uploadProductImage(file);
      change(i, { image: im.url });
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="slide-editor">
      <Field label={"Hauteur du diaporama : " + height + " px"}>
        <input
          type="range"
          min={260}
          max={760}
          step={20}
          value={height}
          onChange={(e) => onHeight(Number(e.target.value))}
        />
      </Field>
      <p className="muted-copy">
        La hauteur s’adapte automatiquement sur téléphone. Le zoom règle la
        taille de chaque image.
      </p>
      {slides.map((h, i) => (
        <details
          className="slide-edit-row"
          key={h.id}
          open={slides.length === 1}
        >
          <summary>
            <span>
              {String(i + 1).padStart(2, "0")} ·{" "}
              {h.title || "Nouvelle diapositive"}
            </span>
          </summary>
          <div className="slide-edit-content">
            <div className="feature-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={i === 0}
                onClick={() => {
                  const copy = [...slides];
                  [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                  onChange(copy);
                }}
              >
                Monter
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={i === slides.length - 1}
                onClick={() => {
                  const copy = [...slides];
                  [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
                  onChange(copy);
                }}
              >
                Descendre
              </button>
              <button
                type="button"
                className="btn btn-outline danger"
                onClick={() => onChange(slides.filter((_, n) => i !== n))}
              >
                <Trash2 size={16} />
                Retirer
              </button>
            </div>
            <Field label="Petit titre">
              <input
                maxLength={150}
                value={h.eyebrow}
                onChange={(e) => change(i, { eyebrow: e.target.value })}
              />
            </Field>
            <Field label="Titre de la diapositive">
              <textarea
                required
                maxLength={200}
                rows={2}
                value={h.title}
                onChange={(e) => change(i, { title: e.target.value })}
              />
            </Field>
            <Field label="Texte de présentation">
              <textarea
                maxLength={1500}
                rows={3}
                value={h.body}
                onChange={(e) => change(i, { body: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Texte du bouton">
                <input
                  maxLength={80}
                  value={h.cta}
                  onChange={(e) => change(i, { cta: e.target.value })}
                />
              </Field>
              {!familyId && (
                <Field label="Destination du bouton">
                  <select
                    value={h.family_id}
                    onChange={(e) => change(i, { family_id: e.target.value })}
                  >
                    <option value="">Tout le catalogue</option>
                    {catalog?.families.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Field label="Ajouter / remplacer l’image">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(i, e.target.files[0]);
                }}
              />
            </Field>
            {h.image && (
              <div className="slide-image-preview">
                <img
                  src={h.image}
                  alt="Aperçu de l’image"
                  style={{
                    objectFit: h.fit || "contain",
                    objectPosition: `${50 + (h.x || 0)}% ${50 + (h.y || 0)}%`,
                    transform: `scale(${h.scale || 1})`,
                  }}
                />
              </div>
            )}
            <div className="form-grid">
              <Field
                label={
                  "Taille de l’image : " +
                  Math.round((h.scale || 1) * 100) +
                  " %"
                }
              >
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={h.scale || 1}
                  onChange={(e) => change(i, { scale: Number(e.target.value) })}
                />
              </Field>
              <Field label="Affichage de l’image">
                <select
                  value={h.fit || "contain"}
                  onChange={(e) =>
                    change(i, { fit: e.target.value as Hero["fit"] })
                  }
                >
                  <option value="contain">Image entière</option>
                  <option value="cover">Remplir et recadrer</option>
                </select>
              </Field>
              <Field label="Position horizontale">
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={h.x || 0}
                  onChange={(e) => change(i, { x: Number(e.target.value) })}
                />
              </Field>
              <Field label="Position verticale">
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={h.y || 0}
                  onChange={(e) => change(i, { y: Number(e.target.value) })}
                />
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={h.visible}
                onChange={(e) => change(i, { visible: e.target.checked })}
              />
              Afficher cette diapositive
            </label>
          </div>
        </details>
      ))}
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy || slides.length >= 12}
        onClick={() =>
          onChange([
            ...slides,
            {
              id: crypto.randomUUID(),
              eyebrow: "UNIPLAST",
              title: "Une nouvelle idée pour votre quotidien.",
              body: "",
              image: "",
              cta: "Découvrir",
              family_id: familyId,
              visible: true,
              scale: 1,
              fit: "contain",
              x: 0,
              y: 0,
            },
          ])
        }
      >
        <Plus size={17} />
        Ajouter une diapositive
      </button>
    </div>
  );
}
export function VisualSettings({
  s,
  onChange,
}: {
  s: Settings;
  onChange: (s: Settings) => void;
}) {
  const { catalog, notify, refresh } = useStore(),
    [familyId, setFamilyId] = useState(""),
    [family, setFamily] = useState<Family | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const f = catalog?.families.find((f) => f.id === familyId);
    setFamily(f ? structuredClone(f) : null);
  }, [familyId]);
  async function saveFamily() {
    if (!family) return;
    setBusy(true);
    try {
      await api.saveFamily(family);
      await refresh();
      notify("Diaporama de la collection enregistré.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <span className="eyebrow">L’ACCUEIL QUI VOUS RESSEMBLE</span>
        <h2>Diaporama de la page d’accueil</h2>
        <Field
          label={
            "Changement automatique : toutes les " +
            s.slider_interval +
            " secondes"
          }
        >
          <input
            type="range"
            min={3}
            max={20}
            step={1}
            value={s.slider_interval}
            onChange={(e) =>
              onChange({ ...s, slider_interval: Number(e.target.value) })
            }
          />
        </Field>
        <SlideEditor
          slides={s.heroes}
          onChange={(heroes) => onChange({ ...s, heroes })}
          height={s.home_slider_height}
          onHeight={(home_slider_height) =>
            onChange({ ...s, home_slider_height })
          }
        />
      </section>
      <section className="panel">
        <h2>Un diaporama pour chaque collection</h2>
        <Field label="Choisir la collection à personnaliser">
          <select
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
          >
            <option value="">Choisir une collection</option>
            {catalog?.families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        {family && (
          <>
            <SlideEditor
              slides={familySlides(family)}
              onChange={(slides) => setFamily({ ...family, slides })}
              familyId={family.id}
              height={family.slider_height || 380}
              onHeight={(slider_height) =>
                setFamily({ ...family, slider_height })
              }
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void saveFamily()}
            >
              {busy ? <Spinner /> : null}Enregistrer le diaporama de cette
              collection
            </button>
          </>
        )}
      </section>
      <section className="panel">
        <h2>Qui sommes-nous ?</h2>
        <Field label="Titre de présentation de l’entreprise">
          <input
            required
            maxLength={200}
            value={s.about_title}
            onChange={(e) => onChange({ ...s, about_title: e.target.value })}
          />
        </Field>
        <Field label="Présentation de l’entreprise">
          <textarea
            required
            rows={8}
            maxLength={10000}
            value={s.about_body}
            onChange={(e) => onChange({ ...s, about_body: e.target.value })}
          />
        </Field>
        <Field label="Photo de la section Qui sommes-nous">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              if (!e.target.files?.[0]) return;
              setBusy(true);
              try {
                const image = await api.uploadProductImage(e.target.files[0]);
                onChange({ ...s, about_image: image.url });
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Field>
        {s.about_image && (
          <img
            className="hero-edit-preview"
            src={s.about_image}
            alt="Présentation UNIPLAST"
          />
        )}
      </section>
    </>
  );
}
export function AboutSection({ full = false }: { full?: boolean }) {
  const { catalog } = useStore();
  if (!catalog) return null;
  const s = catalog.settings;
  return (
    <section className={"about-section " + (full ? "about-full" : "")}>
      <div className="about-visual">
        {s.about_image ? (
          <img src={s.about_image} alt="L’univers UNIPLAST" loading="lazy" />
        ) : (
          <Layers size={120} />
        )}
        <span>
          UNIPLAST
          <br />
          <b>HOME DESIGN.</b>
        </span>
      </div>
      <div className="about-copy">
        <span className="eyebrow">QUI SOMMES-NOUS ?</span>
        {full ? <h1>{s.about_title}</h1> : <h2>{s.about_title}</h2>}
        <p className="preserve-lines">
          {full ? s.about_body : s.about_body.split("\n\n")[0]}
        </p>
        <div className="about-values">
          <span>
            <Package size={22} />
            Des formats adaptés
          </span>
          <span>
            <ShieldCheck size={22} />
            Un colisage clair
          </span>
          <span>
            <Factory size={22} />
            Des projets sur mesure
          </span>
        </div>
        <a
          className="btn btn-outline"
          href={full ? "#/sur-mesure" : "#/a-propos"}
        >
          {full ? "Parlons de votre projet" : "Découvrir UNIPLAST"}
          <ArrowRight size={18} />
        </a>
      </div>
    </section>
  );
}
export function AboutPage() {
  return (
    <main className="container page">
      <AboutSection full />
      <SuggestionBanner />
    </main>
  );
}
export function SuggestionBanner() {
  return (
    <section className="suggestion-banner">
      <MessageCircle size={42} strokeWidth={1.3} />
      <div>
        <span className="eyebrow">VOTRE AVIS NOUS FAIT AVANCER</span>
        <h2>Une idée ? On vous écoute.</h2>
        <p>
          Un nouveau format, une amélioration ou une suggestion pour notre
          boutique.
        </p>
      </div>
      <a className="btn btn-yellow" href="#/suggestions">
        Partager mon idée
        <ArrowRight size={18} />
      </a>
    </section>
  );
}
export function Suggestions() {
  const { catalog } = useStore();
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="container page suggestions-page">
      <div className="page-heading">
        <span className="eyebrow">CHAQUE IDÉE COMPTE</span>
        <h1>Vos suggestions</h1>
        <p>
          Dites-nous ce qui rendrait vos produits et votre expérience encore
          meilleurs.
        </p>
      </div>
      <section className="panel suggestion-form">
        {done ? (
          <>
            <MessageCircle size={42} />
            <h2>Merci pour votre idée.</h2>
            <p>Votre suggestion a bien été transmise à l’équipe UNIPLAST.</p>
            <button className="btn btn-outline" onClick={() => setDone(false)}>
              Envoyer une autre suggestion
            </button>
          </>
        ) : (
          <form
            className="feature-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api.sendFeedback({ name, phone, message });
                setDone(true);
                setMessage("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Votre nom (facultatif)">
                <input
                  value={name}
                  maxLength={150}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Téléphone pour vous répondre (facultatif)">
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={25}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Votre idée ou suggestion">
              <textarea
                required
                rows={7}
                minLength={10}
                maxLength={3000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="J’aimerais trouver un format…"
              />
            </Field>
            <p className="muted-copy">
              Votre message est privé : il est lu uniquement par l’équipe de
              gestion. {catalog?.settings.company_name} utilise vos coordonnées
              pour vous répondre.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <MessageCircle size={18} />}Envoyer ma
              suggestion
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
export function FeedbackManager() {
  const { notify } = useStore();
  const [rows, setRows] = useState<api.Feedback[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      setRows(await api.listFeedback());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Les idées de vos clients</h2>
        <button className="btn btn-outline" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      {!rows.length && (
        <p className="notice">Les nouvelles suggestions apparaîtront ici.</p>
      )}
      {rows.map((r) => (
        <article className="feedback-item" key={r.id}>
          <div className="panel-heading">
            <h3>
              {r.name || "Visiteur"} <small>{r.phone}</small>
            </h3>
            <span>{new Date(r.created_at).toLocaleString("fr-DZ")}</span>
          </div>
          <p className="preserve-lines">{r.message}</p>
          <label>
            Suivi du message{" "}
            <select
              aria-label={"Suivi de la suggestion de " + (r.name || "Visiteur")}
              value={r.status}
              onChange={async (e) => {
                try {
                  await api.setFeedbackStatus(
                    r.id,
                    e.target.value as api.Feedback["status"],
                  );
                  await load();
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <option value="new">Nouveau</option>
              <option value="read">Lu</option>
              <option value="archived">Archivé</option>
            </select>
          </label>
        </article>
      ))}
    </section>
  );
}
