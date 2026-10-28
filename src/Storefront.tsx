import {
  Slider,
  familySlides,
  AboutSection,
  SuggestionBanner,
} from "./Experience";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Factory,
  Grid2X2,
  Headphones,
  Layers,
  Menu,
  Package,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Family, Product } from "./types";
import {
  activeDiscount,
  canBuy,
  money,
  normalizeSearch,
  priceOf,
  rankProducts,
  timeRemaining,
  activeSeasons,
  safeWebUrl,
} from "./domain";
import { navigate, useStore } from "./store";
import { Badges, Empty, ProductPhoto, Quantity, buyLabel } from "./ui";
import { previewMode } from "./api";

export function Header({
  openLogin,
  openScanner,
}: {
  openLogin: () => void;
  openScanner: () => void;
}) {
  const { catalog, cart } = useStore();
  const [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [families, setFamilies] = useState(false);
  const clicks = useRef<number[]>([]);
  const brandClick = () => {
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < 2200);
    clicks.current.push(now);
    if (clicks.current.length >= 5) {
      clicks.current = [];
      openLogin();
    } else navigate("/");
  };
  if (!catalog) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate("/catalogue?q=" + encodeURIComponent(search));
    setMenu(false);
  };
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            UNIPLAST <i /> HOME DESIGN
          </span>
          <span>Des solutions pour la maison et les professionnels</span>
          <span className="topbar-lang">
            Français ·{" "}
            {catalog.settings.currency === "DZD"
              ? "DA"
              : catalog.settings.currency}
          </span>
        </div>
      </div>
      <header className="main-header">
        <div className="container header-inner">
          <button
            className="mobile-menu icon-btn"
            aria-label="Ouvrir le menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <button
            className="brand"
            aria-label="Accueil UNIPLAST"
            onClick={brandClick}
          >
            <img src={catalog.settings.logo_url} alt="UNIPLAST Home Design" />
          </button>
          <form className="search-box" onSubmit={submit}>
            <Search size={20} />
            <input
              aria-label="Rechercher un produit"
              placeholder="Un produit, une référence, un code-barres…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="scan-btn"
              aria-label="Scanner un code-barres"
              onClick={openScanner}
            >
              <ScanLine size={21} />
            </button>
            <button className="search-submit" aria-label="Lancer la recherche">
              <ArrowRight size={20} />
            </button>
          </form>
          <button
            className="header-contact"
            onClick={() => navigate("/sur-mesure")}
          >
            <Headphones size={23} />
            <span>
              Un besoin particulier ?<b>Parlons de votre projet</b>
            </span>
          </button>
          <button className="cart-button" onClick={() => navigate("/panier")}>
            <span className="cart-icon">
              <ShoppingBag size={24} />
              <b>{cart.length}</b>
            </span>
            <span>Mon panier</span>
          </button>
        </div>
        <div className={`navigation ${menu ? "mobile-open" : ""}`}>
          <div className="container nav-inner">
            <div className="family-menu-wrap">
              <button
                className={`family-nav ${families ? "is-open" : ""}`}
                onClick={() => setFamilies(!families)}
              >
                <Grid2X2 size={17} /> Nos collections <ChevronDown size={15} />
              </button>
              {families && (
                <>
                  <button
                    className="dropdown-dismiss"
                    aria-label="Fermer les collections"
                    onClick={() => setFamilies(false)}
                  />
                  <div className="family-dropdown">
                    {catalog.families
                      .filter((f) => f.visible)
                      .map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            navigate("/catalogue?famille=" + f.id);
                            setFamilies(false);
                            setMenu(false);
                          }}
                        >
                          {f.name}
                          <span>
                            {
                              catalog.products.filter(
                                (p) => p.family_id === f.id,
                              ).length
                            }
                          </span>
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
            <a href="#/">Accueil</a>
            <a href="#/catalogue">Tous les produits</a>
            <a href="#/catalogue?filtre=promotions">
              Promotions <span className="tiny-dot" />
            </a>
            <a href="#/a-propos">Qui sommes-nous ?</a>
            <a href="#/sur-mesure">
              Fabrication sur mesure <ArrowUpRight size={14} />
            </a>
            <a href="#/client-agree" className="client-nav">
              <ShieldCheck size={16} /> Client agréé
            </a>
            <a href="#/mes-commandes" className="orders-nav">
              Mes commandes <Package size={16} />
            </a>
          </div>
        </div>
      </header>
      {previewMode && (
        <div className="preview-bar">
          <div className="container">
            <span>
              <span className="status-dot" />
              Mode aperçu · catalogue importé
            </span>
            <span>Commandes non transmises. Disponibilités à valider.</span>
            <button onClick={openLogin}>
              Espace de gestion <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function Footer({
  openPolicy,
}: {
  openPolicy: (type: "privacy" | "terms") => void;
}) {
  const { catalog } = useStore();
  if (!catalog) return null;
  const s = catalog.settings;
  return (
    <footer>
      <div className="container footer-top">
        <div className="footer-brand">
          <img src={s.logo_url} alt="UNIPLAST" />
          <p>
            Des objets utiles, des idées simples.
            <br />
            La maison et les professionnels ont leurs solutions.
          </p>
          <span>Transformation des matières plastiques</span>
        </div>
        <div>
          <h4>Explorez UNIPLAST</h4>
          <a href="#/catalogue">Notre catalogue</a>
          <a href="#/collections">Nos collections</a>
          <a href="#/catalogue?filtre=promotions">Promotions</a>
          <a href="#/sur-mesure">Fabrication sur mesure</a>
        </div>
        <div>
          <h4>Votre commande</h4>
          <a href="#/panier">Mon panier</a>
          <a href="#/mes-commandes">Mes commandes</a>
          <a href="#/a-propos">Qui sommes-nous ?</a>
          <a href="#/suggestions">Vos suggestions</a>
          <a href="#/admin">Espace de gestion</a>
          <button onClick={() => openPolicy("terms")}>
            Conditions de commande
          </button>
          <button onClick={() => openPolicy("privacy")}>Confidentialité</button>
        </div>
        <div>
          <h4>Restons en contact</h4>
          {s.phone ? (
            <a href={"tel:" + s.phone}>{s.phone}</a>
          ) : (
            <p>
              Pour toute information, utilisez
              <br />
              notre formulaire de demande.
            </p>
          )}
          {s.email && <a href={"mailto:" + s.email}>{s.email}</a>}
          {s.secondary_phone && (
            <a href={"tel:" + s.secondary_phone}>{s.secondary_phone}</a>
          )}
          {s.whatsapp_phone && (
            <a
              href={"https://wa.me/" + s.whatsapp_phone.replace(/\D/g, "")}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          )}
          {safeWebUrl(s.facebook_url) && (
            <a
              href={safeWebUrl(s.facebook_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook ↗
            </a>
          )}
          {safeWebUrl(s.website_url) && (
            <a
              href={safeWebUrl(s.website_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Site internet ↗
            </a>
          )}
          {(safeWebUrl(s.catalog_pdf_url) ||
            (previewMode && s.catalog_pdf_url.startsWith("blob:"))) && (
            <a
              href={s.catalog_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.catalog_pdf_title} · PDF ↗
            </a>
          )}
          {s.address && <p>{s.address}</p>}
          <a className="footer-project" href="#/sur-mesure">
            Nous contacter <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} UNIPLAST. Tous droits réservés.
        </span>
        <span>Conserver. Organiser. Simplifier.</span>
      </div>
    </footer>
  );
}
export function ProductCard({ product: p }: { product: Product }) {
  const { catalog, now, openQuantity } = useStore();
  const discounted = activeDiscount(p, now),
    s = catalog!.settings;
  return (
    <article
      className={`product-card ${discounted ? "discounted" : ""} ${p.availability_confirmed && !p.available ? "sold-out" : ""}`}
    >
      <a href={"#/produit/" + p.id} className="card-image-link">
        <ProductPhoto image={p.images[0]} name={p.name} />
        <Badges product={p} now={now} />
        <span className="card-detail-arrow">
          <ArrowUpRight size={19} />
        </span>
      </a>
      <div className="card-info">
        <span className="product-code">RÉF. {p.code}</span>
        <a href={"#/produit/" + p.id} className="product-title">
          {p.name}
        </a>
        <div className="product-specs">
          <span>
            <Package size={13} />
            {p.pack_size} unités / {p.pack_label}
          </span>
          {p.capacity && <span>{p.capacity}</span>}
        </div>
        <p className="card-dimensions">
          {p.dimensions || "Dimensions à renseigner"}
        </p>
        <div className="product-pricing">
          {p.price_hidden ? (
            <a className="price-locked" href="#/client-agree">
              <ShieldCheck size={15} /> Tarifs réservés aux clients agréés
            </a>
          ) : p.price_on_request ? (
            <strong className="on-request">Prix sur demande</strong>
          ) : (
            <>
              <div>
                <strong>{money(priceOf(p, now), s.currency)}</strong>
                <span> / unité</span>
                {discounted && (
                  <del>{money(p.unit_price_cents, s.currency)}</del>
                )}
              </div>
              <small>
                {money(priceOf(p, now) * p.pack_size, s.currency)} /{" "}
                {p.pack_label}
              </small>
            </>
          )}
        </div>
        <div className="card-actions">
          <a href={"#/produit/" + p.id}>
            Détails <ArrowUpRight size={14} />
          </a>
          {p.price_hidden ? (
            <a className="add-btn" href="#/client-agree">
              Voir les prix
            </a>
          ) : canBuy(p) ? (
            <button
              className="add-btn"
              aria-label={`Ajouter ${p.name} au panier`}
              onClick={() => openQuantity(p)}
            >
              <ShoppingBag size={16} />
              <span>Ajouter</span>
            </button>
          ) : p.upcoming && p.preorder_enabled ? (
            <a className="add-btn" href={"#/reservation/" + p.id}>
              Réserver
            </a>
          ) : (
            <button className="add-btn muted" disabled>
              <Box size={16} />
              <span>
                {p.price_on_request
                  ? "Sur demande"
                  : p.availability_confirmed
                    ? "Indisponible"
                    : "À confirmer"}
              </span>
            </button>
          )}
        </div>
        {discounted && (
          <p className="offer-countdown">
            <Clock3 size={12} />
            {timeRemaining(p.discount_end, now)}
            {Date.parse(p.discount_end!) - now < 3 * 86400000 &&
              " · Profitez-en vite !"}
          </p>
        )}
      </div>
    </article>
  );
}
function ProductRail({
  title,
  eyebrow,
  products,
  href,
}: {
  title: string;
  eyebrow?: string;
  products: Product[];
  href: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  return (
    <section className="product-section">
      <div className="section-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <div className="section-actions">
          <a className="text-link" href={href}>
            Tout voir <ArrowRight size={16} />
          </a>
          <div className="rail-arrows">
            <button
              className="icon-btn"
              aria-label={`Précédents produits : ${title}`}
              onClick={() =>
                rail.current?.scrollBy({ left: -640, behavior: "smooth" })
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label={`Produits suivants : ${title}`}
              onClick={() =>
                rail.current?.scrollBy({ left: 640, behavior: "smooth" })
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <div ref={rail} className="product-rail">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
export function Home() {
  const { catalog, now } = useStore(),
    [showAll, setShowAll] = useState(false);
  if (!catalog) return null;
  const { settings: s, products, families, sales } = catalog;
  const visibleFamilies = families
      .filter((f) => f.visible)
      .sort((a, b) => a.sort_order - b.sort_order),
    ranked = rankProducts(
      products.filter((p) => visibleFamilies.some((f) => f.id === p.family_id)),
      sales,
      now,
    );
  if (s.recommendation_mode === "sales")
    ranked.sort((a, b) => (sales[b.id] || 0) - (sales[a.id] || 0));
  const featured = ranked.filter((p) => p.images.length).slice(0, 8);
  const offers = ranked.filter((p) => p.show_offer && activeDiscount(p, now)),
    news = ranked.filter((p) => p.is_new),
    upcoming = ranked.filter((p) => p.upcoming),
    popular = ranked.filter((p) => (sales[p.id] || 0) > 0);
  return (
    <>
      <main>
        <div className="container">
          <Slider
            slides={s.heroes}
            height={s.home_slider_height}
            interval={s.slider_interval}
          />
          <section className="benefits">
            <div>
              <Package />
              <span>
                <b>Commandez par carton</b>
                {s.price_visibility === "approved"
                  ? "Colisage clair · tarifs sur agrément"
                  : "Colisage et prix toujours visibles"}
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                <b>Une commande transparente</b>Chaque quantité, chaque total
              </span>
            </div>
            <div>
              <Factory />
              <span>
                <b>À chaque besoin, sa solution</b>Maison, commerce et
                professionnels
              </span>
            </div>
            <div>
              <Headphones />
              <span>
                <b>Un projet particulier ?</b>Adressez-nous votre demande
              </span>
            </div>
          </section>
          <section className="collections-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TROUVEZ VOTRE UNIVERS</span>
                <h2>De la place pour toutes vos idées.</h2>
              </div>
              <a className="text-link" href="#/collections">
                Les {visibleFamilies.length} collections{" "}
                <ArrowRight size={16} />
              </a>
            </div>
            <div className="collection-grid">
              {visibleFamilies.slice(0, 6).map((f, i) => (
                <a
                  className={"collection-tile tile-" + i}
                  key={f.id}
                  href={"#/catalogue?famille=" + f.id}
                >
                  <span className="collection-count">
                    {products.filter((p) => p.family_id === f.id).length}{" "}
                    produits
                  </span>
                  {f.image ? (
                    <img
                      src={f.image}
                      alt={`Collection ${f.name}`}
                      loading="lazy"
                    />
                  ) : (
                    <Layers size={60} strokeWidth={0.8} />
                  )}
                  <div>
                    <h3>{f.name}</h3>
                    <span className="circle-arrow">
                      <ArrowUpRight size={17} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
          {activeSeasons(s.seasons, s.timezone, now).map((season) => {
            const selection = ranked.filter(
              (p) =>
                season.product_ids.includes(p.id) ||
                season.family_ids.includes(p.family_id),
            );
            return selection.length > 0 ? (
              <div className="season-home" key={season.id}>
                <p className="season-description">{season.description}</p>
                <ProductRail
                  eyebrow="NOTRE SÉLECTION DE SAISON"
                  title={season.title}
                  products={selection.slice(0, 12)}
                  href={"#/catalogue?saison=" + encodeURIComponent(season.id)}
                />
              </div>
            ) : null;
          })}
          {featured.length > 0 && (
            <ProductRail
              eyebrow="À DÉCOUVRIR"
              title="Les essentiels UNIPLAST"
              products={featured}
              href="#/catalogue"
            />
          )}
          <div className="section-tabs">
            <a href="#/catalogue?filtre=promotions">
              <span className="mini-badge">%</span>Promotions{" "}
              <b>{offers.length}</b>
            </a>
            <a href="#/catalogue?filtre=nouveautes">
              <Layers size={18} />
              Nouveautés <b>{news.length}</b>
            </a>
            <a href="#/catalogue?tri=populaires">
              <Package size={18} />
              Les plus demandés <b>{popular.length}</b>
            </a>
            <a href="#/catalogue?filtre=bientot">
              <Clock3 size={18} />
              Bientôt disponibles <b>{upcoming.length}</b>
            </a>
          </div>
          {offers.length > 0 && (
            <ProductRail
              eyebrow="LES OFFRES DU MOMENT"
              title="À saisir, tout simplement."
              products={offers.slice(0, 8)}
              href="#/catalogue?filtre=promotions"
            />
          )}
          {news.length > 0 && (
            <ProductRail
              title="Les dernières nouveautés"
              products={news.slice(0, 8)}
              href="#/catalogue?filtre=nouveautes"
            />
          )}
          {popular.length > 0 && (
            <ProductRail
              title="Vos produits les plus demandés"
              products={popular.slice(0, 8)}
              href="#/catalogue?tri=populaires"
            />
          )}
          <AboutSection />
          <SuggestionBanner />
          <section className="custom-banner">
            <div className="custom-banner-icon">
              <Factory size={48} strokeWidth={1} />
            </div>
            <div>
              <span className="eyebrow">VOS IDÉES PRENNENT FORME</span>
              <h2>Un besoin qui sort du cadre ?</h2>
              <p>
                Dimensions, couleurs, quantités… Parlez-nous de votre projet de
                fabrication.
              </p>
            </div>
            <a className="btn btn-yellow" href="#/sur-mesure">
              Présenter mon projet <ArrowUpRight size={18} />
            </a>
          </section>
          <div className="universes-heading">
            <span className="eyebrow">LE CATALOGUE, PAR COLLECTION</span>
            <h2>Explorez à votre façon.</h2>
          </div>
          {visibleFamilies
            .slice(0, showAll ? visibleFamilies.length : 3)
            .map((f) => (
              <ProductRail
                key={f.id}
                title={f.name}
                products={ranked
                  .filter((p) => p.family_id === f.id)
                  .slice(0, 8)}
                href={"#/catalogue?famille=" + f.id}
              />
            ))}
          {!showAll && visibleFamilies.length > 3 && (
            <div className="show-more">
              <button
                className="btn btn-outline"
                onClick={() => setShowAll(true)}
              >
                Explorer les {visibleFamilies.length - 3} autres collections{" "}
                <ArrowDown size={17} />
              </button>
            </div>
          )}
          {upcoming.length > 0 && (
            <ProductRail
              title="Bientôt dans votre quotidien"
              products={upcoming.slice(0, 8)}
              href="#/catalogue?filtre=bientot"
            />
          )}
        </div>
      </main>
    </>
  );
}
export function Collections() {
  const { catalog } = useStore();
  if (!catalog) return null;
  return (
    <main className="container page">
      <div className="page-heading">
        <span className="eyebrow">LE CATALOGUE UNIPLAST</span>
        <h1>Nos collections</h1>
        <p>Choisissez votre univers, nous avons de quoi vous inspirer.</p>
      </div>
      <div className="collection-page-grid">
        {catalog.families
          .filter((f) => f.visible)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((f) => (
            <a
              className="collection-page-tile"
              key={f.id}
              href={"#/catalogue?famille=" + f.id}
            >
              {f.image ? (
                <img src={f.image} alt={f.name} />
              ) : (
                <Layers size={70} strokeWidth={0.7} />
              )}
              <div>
                <h2>{f.name}</h2>
                <span>
                  {catalog.products.filter((p) => p.family_id === f.id).length}{" "}
                  références
                </span>
              </div>
              <ArrowUpRight size={20} />
            </a>
          ))}
      </div>
    </main>
  );
}
export function Catalogue({ params }: { params: URLSearchParams }) {
  const { catalog, now } = useStore();
  const [q, setQ] = useState(params.get("q") || ""),
    [family, setFamily] = useState(params.get("famille") || ""),
    [filter, setFilter] = useState(params.get("filtre") || ""),
    [sort, setSort] = useState(params.get("tri") || "recommande"),
    [page, setPage] = useState(1),
    [mobileFilters, setMobileFilters] = useState(false);
  const queryString = params.toString();
  useEffect(() => {
    setQ(params.get("q") || "");
    setFamily(params.get("famille") || "");
    setFilter(params.get("filtre") || "");
    setSort(params.get("tri") || "recommande");
    setPage(1);
  }, [queryString]);
  if (!catalog) return null;
  const families = catalog.families.filter((f) => f.visible),
    familyName = families.find((f) => f.id === family)?.name;
  let products = rankProducts(catalog.products, catalog.sales, now).filter(
    (p) =>
      families.some((f) => f.id === p.family_id) &&
      (!family || p.family_id === family),
  );
  const seasonId = params.get("saison"),
    season = activeSeasons(
      catalog.settings.seasons,
      catalog.settings.timezone,
      now,
    ).find((s) => s.id === seasonId);
  if (seasonId)
    products = season
      ? products.filter(
          (p) =>
            season.product_ids.includes(p.id) ||
            season.family_ids.includes(p.family_id),
        )
      : [];
  if (sort === "recommande" && catalog.settings.recommendation_mode === "sales")
    products.sort(
      (a, b) => (catalog.sales[b.id] || 0) - (catalog.sales[a.id] || 0),
    );
  const words = normalizeSearch(q).split(/\s+/).filter(Boolean);
  if (words.length)
    products = products.filter((p) =>
      words.every((w) =>
        normalizeSearch(
          `${p.name} ${p.name_fr} ${p.code} ${p.barcode || ""}`,
        ).includes(w),
      ),
    );
  if (filter === "disponibles")
    products = products.filter(
      (p) =>
        p.available &&
        p.availability_confirmed &&
        !p.upcoming &&
        (p.stock_cartons === null || p.stock_cartons > 0),
    );
  if (filter === "promotions")
    products = products.filter((p) => activeDiscount(p, now));
  if (filter === "nouveautes") products = products.filter((p) => p.is_new);
  if (filter === "bientot") products = products.filter((p) => p.upcoming);
  if (filter === "sur-demande")
    products = products.filter((p) => p.price_on_request);
  if (sort === "prix-croissant")
    products.sort(
      (a, b) =>
        (a.price_on_request ? Infinity : priceOf(a, now)) -
        (b.price_on_request ? Infinity : priceOf(b, now)),
    );
  if (sort === "prix-decroissant")
    products.sort(
      (a, b) =>
        (b.price_on_request ? -1 : priceOf(b, now)) -
        (a.price_on_request ? -1 : priceOf(a, now)),
    );
  if (sort === "recent")
    products.sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  if (sort === "populaires")
    products.sort(
      (a, b) => (catalog.sales[b.id] || 0) - (catalog.sales[a.id] || 0),
    );
  const reset = () => {
    setQ("");
    setFamily("");
    setFilter("");
    setSort("recommande");
    setPage(1);
  };
  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="#/">Accueil</a>
        <ChevronRight size={12} />
        <span>Catalogue</span>
        {familyName && (
          <>
            <ChevronRight size={12} />
            <span>{familyName}</span>
          </>
        )}
      </div>
      {family && families.find((f) => f.id === family) && (
        <Slider
          key={family}
          compact
          slides={familySlides(families.find((f) => f.id === family)!)}
          height={families.find((f) => f.id === family)!.slider_height || 380}
          interval={catalog.settings.slider_interval}
        />
      )}
      <div className="catalog-heading" id="collection-products">
        <div>
          <span className="eyebrow">L’UNIVERS UNIPLAST</span>
          <h1>{season?.title || familyName || "Le catalogue"}</h1>
          {seasonId && (
            <a className="text-link" href="#/catalogue">
              Voir tout le catalogue →
            </a>
          )}
          <p>
            {catalog.products.length} références pour trouver votre solution.
          </p>
        </div>
        <div className="catalog-count">
          <b>{String(products.length).padStart(2, "0")}</b>
          <span>
            produits
            <br />
            correspondants
          </span>
        </div>
      </div>
      <div className="catalog-layout">
        <aside
          className={`catalog-sidebar ${mobileFilters ? "filters-open" : ""}`}
        >
          <div className="sidebar-heading">
            <h3>Affiner la sélection</h3>
            <button
              className="icon-btn mobile-only"
              onClick={() => setMobileFilters(false)}
              aria-label="Fermer les filtres"
            >
              <X size={18} />
            </button>
          </div>
          <h4>Collections</h4>
          <button
            className={`family-filter ${!family ? "selected" : ""}`}
            onClick={() => {
              setFamily("");
              setPage(1);
            }}
          >
            <span>Toutes les collections</span>
            <b>{catalog.products.length}</b>
          </button>
          {families.map((f) => (
            <button
              className={`family-filter ${family === f.id ? "selected" : ""}`}
              key={f.id}
              onClick={() => {
                setFamily(f.id);
                setPage(1);
              }}
            >
              <span>{f.name}</span>
              <b>
                {catalog.products.filter((p) => p.family_id === f.id).length}
              </b>
            </button>
          ))}
          <h4>À la une</h4>
          {[
            ["", "Tous les produits"],
            ["disponibles", "Disponibles"],
            ["promotions", "En promotion"],
            ["nouveautes", "Nouveautés"],
            ["bientot", "Bientôt disponibles"],
            ["sur-demande", "Prix sur demande"],
          ].map(([v, label]) => (
            <label className="radio-filter" key={v}>
              <input
                type="radio"
                name="state-filter"
                value={v}
                checked={filter === v}
                onChange={() => {
                  setFilter(v);
                  setPage(1);
                }}
              />
              {label}
            </label>
          ))}
          <button className="reset-filters" onClick={reset}>
            Réinitialiser les filtres
          </button>
        </aside>
        <section className="catalog-results">
          <div className="catalog-toolbar">
            <div className="catalog-search">
              <Search size={18} />
              <input
                aria-label="Rechercher dans les résultats"
                value={q}
                placeholder="Rechercher dans le catalogue…"
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              {q && (
                <button
                  aria-label="Effacer la recherche"
                  className="icon-btn"
                  onClick={() => setQ("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="btn btn-outline filter-toggle"
              onClick={() => setMobileFilters(!mobileFilters)}
            >
              <SlidersHorizontal size={17} />
              Filtres
            </button>
            <select
              aria-label="Trier les produits"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="recommande">Notre sélection</option>
              <option value="prix-croissant">Prix croissant</option>
              <option value="prix-decroissant">Prix décroissant</option>
              <option value="populaires">Les plus demandés</option>
              <option value="recent">Les plus récents</option>
            </select>
          </div>
          <div className="result-summary">
            <span>
              {products.length} résultat{products.length > 1 ? "s" : ""}
            </span>
            {(q || family || filter) && (
              <button onClick={reset}>
                Effacer la sélection <X size={12} />
              </button>
            )}
          </div>
          {products.length ? (
            <>
              <div className="product-grid">
                {products.slice((page - 1) * 24, page * 24).map((p) => (
                  <ProductCard product={p} key={p.id} />
                ))}
              </div>
              {products.length > 24 && (
                <div className="pagination">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setPage(Math.max(1, page - 1));
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    disabled={page === 1}
                  >
                    <ArrowLeft size={16} />
                    Précédent
                  </button>
                  <span>
                    Page {page} sur {Math.ceil(products.length / 24)}
                  </span>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setPage(
                        Math.min(Math.ceil(products.length / 24), page + 1),
                      );
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    disabled={page >= Math.ceil(products.length / 24)}
                  >
                    Suivant
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty
              title="Aucun produit pour cette sélection"
              body={
                filter === "promotions"
                  ? "Aucune promotion active pour le moment. Retrouvez les tarifs du catalogue."
                  : "Essayez une autre référence ou élargissez vos filtres."
              }
            >
              <button className="btn btn-primary" onClick={reset}>
                Voir tous les produits
              </button>
            </Empty>
          )}
        </section>
      </div>
    </main>
  );
}
export function ProductDetails({ id }: { id: string }) {
  const { catalog, now, addCart } = useStore();
  const [image, setImage] = useState(0),
    [n, setN] = useState(1);
  useEffect(() => {
    setImage(0);
    setN(1);
  }, [id]);
  if (!catalog) return null;
  const p = catalog.products.find(
    (p) =>
      p.id === id &&
      catalog.families.some((f) => f.id === p.family_id && f.visible),
  );
  if (!p)
    return (
      <main className="container page">
        <Empty
          title="Produit introuvable"
          body="Cette référence a été retirée ou n’est plus visible."
        >
          <a className="btn btn-primary" href="#/catalogue">
            Retour au catalogue
          </a>
        </Empty>
      </main>
    );
  const family = catalog.families.find((f) => f.id === p.family_id),
    discount = activeDiscount(p, now),
    currency = catalog.settings.currency;
  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="#/">Accueil</a>
        <ChevronRight size={12} />
        <a href={"#/catalogue?famille=" + p.family_id}>
          {family?.name || "Catalogue"}
        </a>
        <ChevronRight size={12} />
        <span>{p.code}</span>
      </div>
      <div className="product-detail-layout">
        <div className="detail-gallery">
          <div className="detail-image">
            <ProductPhoto image={p.images[image]} name={p.name} eager />
            <Badges product={p} now={now} />
          </div>
          {p.images.length > 1 && (
            <div className="gallery-thumbs">
              {p.images.map((im, i) => (
                <button
                  key={im.url}
                  className={image === i ? "selected" : ""}
                  onClick={() => setImage(i)}
                  aria-label={`Afficher la photo ${i + 1}`}
                >
                  <img src={im.url} alt={`Vue ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-content">
          <span className="eyebrow">{family?.name}</span>
          <h1>{p.name}</h1>
          <span className="detail-ref">Référence {p.code}</span>
          <p className="detail-description">{p.description}</p>
          <div className="detail-prices">
            {p.price_hidden ? (
              <a className="price-locked" href="#/client-agree">
                <ShieldCheck size={18} /> Connectez-vous pour consulter les
                tarifs
              </a>
            ) : p.price_on_request ? (
              <strong>Prix sur demande</strong>
            ) : (
              <>
                <strong>{money(priceOf(p, now), currency)}</strong>
                <span>l’unité</span>
                {discount && <del>{money(p.unit_price_cents, currency)}</del>}
                <p>
                  {money(priceOf(p, now) * p.pack_size, currency)}{" "}
                  <span>
                    le {p.pack_label} de {p.pack_size} unités
                  </span>
                </p>
              </>
            )}
            {discount && (
              <div className="offer-countdown">
                <Clock3 size={14} />
                {p.offer_title || "Offre en cours"} ·{" "}
                {timeRemaining(p.discount_end, now)}
              </div>
            )}
          </div>
          <dl className="detail-spec-table">
            <div>
              <dt>Colisage</dt>
              <dd>
                {p.pack_size} unités / {p.pack_label}
              </dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{p.dimensions || "Non renseignées"}</dd>
            </div>
            <div>
              <dt>Capacité</dt>
              <dd>{p.capacity || "Non renseignée"}</dd>
            </div>
            <div>
              <dt>Matière</dt>
              <dd>{p.material || "Non renseignée"}</dd>
            </div>
            <div>
              <dt>Code-barres</dt>
              <dd className="mono">
                {p.barcode || "Non renseigné ou à vérifier"}
              </dd>
            </div>
          </dl>
          {canBuy(p) ? (
            <div className="detail-purchase">
              <label>Nombre de {p.pack_label}s</label>
              <div className="detail-buy-row">
                <Quantity
                  value={n}
                  onChange={setN}
                  max={p.stock_cartons ?? 10000}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => addCart(p, n)}
                >
                  <ShoppingBag size={18} />
                  Ajouter au panier
                </button>
              </div>
              <p>
                <b>{n * p.pack_size} unités</b> · Total{" "}
                {money(n * p.pack_size * priceOf(p, now), currency)}
              </p>
            </div>
          ) : p.price_hidden ? (
            <a className="btn btn-primary" href="#/client-agree">
              <ShieldCheck size={17} /> Accéder aux tarifs
            </a>
          ) : p.upcoming && p.preorder_enabled ? (
            <a className="btn btn-primary" href={"#/reservation/" + p.id}>
              Réserver ce produit <ArrowRight size={17} />
            </a>
          ) : (
            <div className="availability-notice">
              <Box size={20} />
              <div>
                <b>
                  {p.availability_confirmed
                    ? "Produit indisponible"
                    : "Disponibilité à confirmer"}
                </b>
                <p>
                  {p.price_on_request
                    ? "Le prix doit être renseigné avant la commande."
                    : "Contactez-nous pour connaître les conditions de disponibilité."}
                </p>
                <a href={"#/sur-mesure?produit=" + p.id}>
                  Demander des informations <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          )}
          <div className="detail-reassurance">
            <ShieldCheck size={16} />
            Prix et disponibilité vérifiés lors de l’envoi de la commande.
          </div>
        </div>
      </div>
      <ProductRail
        title="Dans la même collection"
        products={catalog.products
          .filter((item) => item.family_id === p.family_id && item.id !== p.id)
          .slice(0, 8)}
        href={"#/catalogue?famille=" + p.family_id}
      />
    </main>
  );
}
