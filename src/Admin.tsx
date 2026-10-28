import {
  VisualSettings,
  FeedbackManager,
  SlideEditor,
  familySlides,
} from "./Experience";
import { AdminPasswordSettings } from "./ClientAccess";
import { imageLimitMo } from "./localApi";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Factory,
  FileText,
  Grid2X2,
  ImagePlus,
  Info,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type {
  Family,
  Hero,
  Order,
  Product,
  ProductImage,
  RequestRecord,
  Settings,
} from "./types";
import {
  activeDiscount,
  money,
  normalizeSearch,
  ORDER_LABELS,
  REQUEST_LABELS,
  salesStats,
} from "./domain";
import { navigate, useStore } from "./store";
import { Empty, Field, Modal, ProductPhoto, Spinner } from "./ui";
import * as api from "./api";
import { InvoiceActions, InvoicePaper } from "./Commerce";
import { AdvancedSettings, CustomerAccessManager } from "./CustomerFeatures";

const tabs = [
  ["overview", "Vue d’ensemble", LayoutDashboard],
  ["products", "Produits", Package],
  ["families", "Collections", Grid2X2],
  ["orders", "Commandes", ShoppingBag],
  ["requests", "Réservations & projets", Factory],
  ["clients", "Clients agréés", ShieldCheck],
  ["feedback", "Suggestions clients", Bell],
  ["settings", "Réglages", Settings2],
] as const;
function dateInput(iso: string | null, zone: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
function dateISO(value: string, zone: string) {
  if (!value) return null;
  const [d, t] = value.split("T"),
    [y, m, day] = d.split("-").map(Number),
    [h, min] = t.split(":").map(Number),
    wall = Date.UTC(y, m - 1, day, h, min);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const formatted = dateInput(new Date(guess).toISOString(), zone),
      asUTC = Date.parse(formatted + "Z");
    guess += wall - asUTC;
  }
  const out = new Date(guess).toISOString();
  if (dateInput(out, zone) !== value)
    throw new Error("Cette heure n’existe pas dans le fuseau sélectionné.");
  return out;
}
function newProduct(family: string, packLabel: string): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    name_fr: "",
    code: "",
    barcode: null,
    family_id: family,
    description: "",
    dimensions: "",
    capacity: "",
    material: "",
    pack_size: 1,
    pack_label: packLabel,
    unit_price_cents: 0,
    price_on_request: true,
    available: false,
    availability_confirmed: false,
    stock_cartons: null,
    is_new: false,
    upcoming: false,
    preorder_enabled: false,
    discount_price_cents: null,
    discount_start: null,
    discount_end: null,
    offer_title: "",
    show_offer: true,
    pinned: false,
    sort_order: 999,
    images: [],
    created_at: new Date().toISOString(),
  };
}
export function Admin({ openLogin }: { openLogin: () => void }) {
  const { catalog, admin, checkAdmin, notify, refresh } = useStore();
  const [tab, setTab] = useState("overview"),
    [orders, setOrders] = useState<Order[]>([]),
    [requests, setRequests] = useState<RequestRecord[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    setBusy(true);
    try {
      const [o, r] = await Promise.all([
        api.listOrders(true),
        api.listRequests(),
      ]);
      setOrders(o);
      setRequests(r);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (admin) void load();
  }, [admin, tab]);
  if (!catalog) return null;
  if (!admin)
    return (
      <main className="container page">
        <Empty
          title="Espace réservé à l’administration"
          body="Connectez-vous avec un compte autorisé pour gérer le catalogue et les commandes."
        >
          <button className="btn btn-primary" onClick={openLogin}>
            <ShieldCheck size={18} />
            Se connecter
          </button>
        </Empty>
      </main>
    );
  const exit = async () => {
    try {
      await api.logout();
      await checkAdmin();
      await refresh();
      navigate("/");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const exportData = () => {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              catalog,
              orders,
              requests,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = `uniplast-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <span>UNIPLAST</span>
          <b>ESPACE DE GESTION</b>
        </div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
              {id === "orders" &&
                orders.filter((o) => o.status === "new").length > 0 && (
                  <span>{orders.filter((o) => o.status === "new").length}</span>
                )}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="#/">
            <ArrowUpRight size={17} />
            Voir le magasin
          </a>
          <button onClick={() => void exit()}>
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      </aside>
      <section className="admin-main">
        <div className="admin-topline">
          <div>
            <span className="eyebrow">BONJOUR, L’ÉQUIPE UNIPLAST</span>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
          </div>
          <div>
            <button className="btn btn-outline" onClick={exportData}>
              <Download size={16} />
              Exporter
            </button>
            <span className="admin-avatar">UP</span>
          </div>
        </div>
        {api.previewMode && (
          <div className="notice amber admin-preview">
            <Info size={18} />
            <span>
              <b>Tableau de bord d’aperçu.</b> Le catalogue contient les données
              du CSV. Vos modifications restent en mémoire jusqu’au rechargement
              ; aucun enregistrement distant n’a lieu.
            </span>
          </div>
        )}
        {error && (
          <div className="error-message">
            {error} <button onClick={() => void load()}>Réessayer</button>
          </div>
        )}
        {tab === "overview" && (
          <Overview
            orders={orders}
            requests={requests}
            setTab={setTab}
            busy={busy}
          />
        )}
        {tab === "products" && <ProductManager />}
        {tab === "families" && <FamilyManager />}
        {tab === "orders" && (
          <OrderManager orders={orders} reload={load} busy={busy} />
        )}
        {tab === "requests" && (
          <RequestManager requests={requests} reload={load} busy={busy} />
        )}
        {tab === "settings" && <SettingsManager />}
        {tab === "feedback" && <FeedbackManager />}
        {tab === "clients" && <CustomerAccessManager />}
      </section>
    </main>
  );
}
function Overview({
  orders,
  requests,
  setTab,
  busy,
}: {
  orders: Order[];
  requests: RequestRecord[];
  setTab: (s: string) => void;
  busy: boolean;
}) {
  const { catalog } = useStore();
  const [period, setPeriod] = useState("30"),
    [currency, setCurrency] = useState(catalog!.settings.currency);
  if (!catalog) return null;
  const since = period === "all" ? 0 : Date.now() - Number(period) * 86400000,
    stats = salesStats(
      orders.filter((o) => o.currency === currency),
      since,
    );
  const unknown = catalog.products.filter(
      (p) => !p.availability_confirmed,
    ).length,
    missing = catalog.products.filter((p) => p.price_on_request).length,
    unavailable = catalog.products.filter(
      (p) =>
        p.availability_confirmed && (!p.available || p.stock_cartons === 0),
    ).length;
  const chart = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      d.setHours(0, 0, 0, 0);
      const next = d.getTime() + 86400000;
      return {
        label: d.toLocaleDateString("fr-DZ", { weekday: "short" }),
        value: orders
          .filter(
            (o) =>
              !o.preview &&
              o.currency === currency &&
              ["confirmed", "preparing", "delivered"].includes(o.status) &&
              Date.parse(o.created_at) >= Math.max(since, d.getTime()) &&
              Date.parse(o.created_at) < next,
          )
          .reduce((s, o) => s + o.total_cents, 0),
      };
    }),
    max = Math.max(1, ...chart.map((d) => d.value));
  return (
    <>
      <div className="dashboard-filter">
        <p>Vos chiffres, à partir des commandes réelles.</p>
        <div>
          <select
            aria-label="Devise des statistiques"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {Array.from(
              new Set([
                catalog.settings.currency,
                ...orders.map((o) => o.currency),
              ]),
            ).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Période des statistiques"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="all">Depuis le début</option>
          </select>
        </div>
      </div>
      <div className="stat-grid">
        {[
          [money(stats.revenue, currency), "Ventes confirmées", BarChart3],
          [String(stats.count), "Commandes retenues", ClipboardList],
          [money(stats.average, currency), "Panier moyen", ShoppingBag],
          [
            `${stats.cartons} / ${stats.units}`,
            "Cartons / unités vendus",
            Package,
          ],
        ].map(([value, label, Icon]) => {
          const I = Icon as typeof Package;
          return (
            <div className="stat-card" key={label as string}>
              <span>
                <I size={20} />
              </span>
              <p>{label as string}</p>
              <strong>{busy ? "…" : (value as string)}</strong>
            </div>
          );
        })}
      </div>
      <p className="dashboard-rule">
        Ventes : commandes confirmées, en préparation ou livrées. Les
        annulations, nouvelles demandes, réservations et aperçus sont exclus.
        Une seule devise est additionnée à la fois.
      </p>
      <div className="dashboard-middle">
        <section className="panel">
          <div className="panel-heading">
            <h2>Ventes des 7 derniers jours</h2>
            <span>{currency}</span>
          </div>
          <div className="sales-chart">
            {chart.map((d, i) => (
              <div className="chart-column" key={i}>
                <span>{d.value ? money(d.value, currency) : "0"}</span>
                <i
                  style={{ height: `${Math.max(2, (d.value / max) * 135)}px` }}
                />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel dashboard-alerts">
          <div className="panel-heading">
            <h2>À votre attention</h2>
            <Bell size={18} />
          </div>
          <button onClick={() => setTab("products")}>
            <span className="alert-number amber-text">{unknown}</span>
            <span>disponibilités à confirmer</span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setTab("products")}>
            <span className="alert-number">{missing}</span>
            <span>tarifs à compléter</span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setTab("products")}>
            <span className="alert-number">{unavailable}</span>
            <span>produits indisponibles</span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setTab("requests")}>
            <span className="alert-number">
              {requests.filter((r) => r.status === "pending").length}
            </span>
            <span>projets / réservations à examiner</span>
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Les produits les plus demandés</h2>
          <button className="text-link" onClick={() => setTab("orders")}>
            Voir les commandes <ArrowRight size={15} />
          </button>
        </div>
        {stats.products.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Cartons</th>
                  <th>Unités</th>
                  <th>Ventes</th>
                </tr>
              </thead>
              <tbody>
                {stats.products.slice(0, 6).map(([id, p]) => (
                  <tr key={id}>
                    <td>{p.name}</td>
                    <td>{p.cartons}</td>
                    <td>{p.units}</td>
                    <td>{money(p.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Les premières ventes s’afficheront ici."
            body="Aucune commande réelle confirmée pour cette période et cette devise."
          />
        )}
      </section>
    </>
  );
}
function ProductManager() {
  const { catalog, refresh, notify } = useStore();
  const [q, setQ] = useState(""),
    [family, setFamily] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Product | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Product | null>(null),
    [busy, setBusy] = useState(false);
  if (!catalog) return null;
  let products = catalog.products.filter(
    (p) =>
      (!family || p.family_id === family) &&
      normalizeSearch(p.name + " " + p.code + " " + p.barcode).includes(
        normalizeSearch(q),
      ),
  );
  if (filter === "unknown")
    products = products.filter((p) => !p.availability_confirmed);
  if (filter === "price") products = products.filter((p) => p.price_on_request);
  if (filter === "barcode") products = products.filter((p) => !p.barcode);
  if (filter === "offers")
    products = products.filter((p) => p.discount_price_cents !== null);
  const availability = async (p: Product, checked: boolean) => {
    setBusy(true);
    try {
      await api.saveProduct({
        ...p,
        available: checked,
        availability_confirmed: true,
      });
      await refresh();
      notify(
        api.previewMode
          ? "Disponibilité modifiée dans l’aperçu."
          : "Disponibilité mise à jour.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.removeProduct(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      notify(
        "Produit retiré du catalogue. Les anciennes commandes conservent leur copie.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="manager-heading">
        <div>
          <h2>{catalog.products.length} références au catalogue</h2>
          <p>
            Prix unitaires issus de P.V. TTC. Le code produit et le code-barres
            sont distincts.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            setEdit(
              newProduct(
                catalog.families[0]?.id || "",
                catalog.settings.pack_label,
              ),
            )
          }
        >
          <Plus size={17} />
          Ajouter un produit
        </button>
      </div>
      <div className="panel">
        <div className="manager-toolbar">
          <div className="catalog-search">
            <Search size={17} />
            <input
              aria-label="Rechercher un produit dans la gestion"
              placeholder="Nom, référence, code-barres…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filtrer la famille des produits"
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes les collections</option>
            {catalog.families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Diagnostic des produits"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les états</option>
            <option value="unknown">Disponibilité à confirmer</option>
            <option value="price">Prix absent</option>
            <option value="barcode">Code-barres à vérifier</option>
            <option value="offers">Avec un réglage de remise</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table product-admin-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Collection</th>
                <th>Unité / carton</th>
                <th>Colisage</th>
                <th>Disponible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.slice((page - 1) * 25, page * 25).map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="admin-product-name">
                      <ProductPhoto image={p.images[0]} name={p.name} />
                      <div>
                        <b>{p.name}</b>
                        {!p.availability_confirmed && (
                          <small className="amber-text">
                            Disponibilité non confirmée
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mono">{p.code}</td>
                  <td>
                    {catalog.families.find((f) => f.id === p.family_id)?.name}
                  </td>
                  <td>
                    {p.price_on_request ? (
                      <span className="amber-text">Sur demande</span>
                    ) : (
                      <>
                        {money(p.unit_price_cents, catalog.settings.currency)}
                        <small>
                          {money(
                            p.unit_price_cents * p.pack_size,
                            catalog.settings.currency,
                          )}{" "}
                          / {p.pack_label}
                        </small>
                      </>
                    )}
                  </td>
                  <td>{p.pack_size}</td>
                  <td>
                    <input
                      className="availability-checkbox"
                      aria-label={"Disponibilité de " + p.name}
                      type="checkbox"
                      checked={p.available && p.availability_confirmed}
                      disabled={busy}
                      onChange={(e) => void availability(p, e.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        aria-label={"Modifier " + p.name}
                        onClick={() => setEdit(structuredClone(p))}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={"Retirer " + p.name}
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <Empty
            title="Aucune référence trouvée"
            body="Modifiez votre recherche ou vos filtres."
          />
        )}
        <div className="manager-pagination">
          <span>
            {products.length} résultats · Page {page} /{" "}
            {Math.max(1, Math.ceil(products.length / 25))}
          </span>
          <div>
            <button
              className="icon-btn"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Page suivante"
              disabled={page >= Math.ceil(products.length / 25)}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {edit && <ProductEditor product={edit} onClose={() => setEdit(null)} />}
      {deleteTarget && (
        <Modal
          title="Retirer le produit ?"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            « {deleteTarget.name} » sera retiré du catalogue. Les données déjà
            enregistrées dans les commandes restent intactes.
          </p>
          <div className="dialog-action-stack">
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? <Spinner /> : <Trash2 size={16} />}Retirer le produit
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setDeleteTarget(null)}
            >
              Conserver
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ProductEditor({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { catalog, notify, refresh } = useStore();
  const [p, setP] = useState<Product>(product),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [imageIndex, setImageIndex] = useState(0);
  if (!catalog) return null;
  const zone = catalog.settings.timezone,
    im = p.images[imageIndex];
  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));
  const updateImage = (patch: Partial<ProductImage>) =>
    set(
      "images",
      p.images.map((image, i) =>
        i === imageIndex ? { ...image, ...patch } : image,
      ),
    );
  const upload = async (files: FileList | null) => {
    if (!files) return;
    if (files.length + p.images.length > 10) {
      notify("10 images maximum par produit.", true);
      return;
    }
    setUploading(true);
    try {
      const added: ProductImage[] = [];
      for (const file of Array.from(files))
        added.push(await api.uploadProductImage(file));
      setP((prev) => ({ ...prev, images: [...prev.images, ...added] }));
      if (!p.images.length) setImageIndex(0);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setUploading(false);
    }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveProduct({
        ...p,
        name_fr: p.name,
        barcode: p.barcode?.trim() || null,
      });
      await refresh();
      notify(
        api.previewMode
          ? "Produit modifié dans l’aperçu de cette session."
          : "Produit enregistré.",
      );
      onClose();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const moveImage = (delta: number) => {
    const next = imageIndex + delta;
    if (next < 0 || next >= p.images.length) return;
    const list = [...p.images];
    [list[imageIndex], list[next]] = [list[next], list[imageIndex]];
    set("images", list);
    setImageIndex(next);
  };
  return (
    <Modal
      title={product.code ? "Modifier le produit" : "Nouveau produit"}
      onClose={onClose}
      wide
    >
      <form onSubmit={(e) => void save(e)} className="product-editor">
        <div className="editor-grid">
          <div>
            <h3>Les informations essentielles</h3>
            <Field label="Nom du produit *">
              <input
                required
                maxLength={150}
                value={p.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Référence produit *">
                <input
                  required
                  maxLength={80}
                  value={p.code}
                  onChange={(e) => set("code", e.target.value)}
                  className="mono"
                />
              </Field>
              <Field label="Code-barres (champ distinct)">
                <input
                  maxLength={80}
                  value={p.barcode || ""}
                  onChange={(e) => set("barcode", e.target.value || null)}
                  className="mono"
                />
              </Field>
            </div>
            <Field label="Collection *">
              <select
                required
                value={p.family_id}
                onChange={(e) => set("family_id", e.target.value)}
              >
                <option value="">Choisir une collection</option>
                {catalog.families.map((f) => (
                  <option value={f.id} key={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Colisage : unités par colis *">
                <input
                  type="number"
                  required
                  min={1}
                  max={10000}
                  step={1}
                  value={p.pack_size}
                  onChange={(e) => set("pack_size", Number(e.target.value))}
                />
              </Field>
              <Field label="Nom du colis">
                <input
                  required
                  value={p.pack_label}
                  maxLength={30}
                  onChange={(e) => set("pack_label", e.target.value)}
                  placeholder="carton, paquet…"
                />
              </Field>
              <Field label="Prix unitaire">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  max={1000000}
                  value={p.unit_price_cents / 100}
                  onChange={(e) =>
                    set(
                      "unit_price_cents",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </Field>
              <Field label="Prix du carton (calculé)">
                <output className="calculated-price">
                  {p.price_on_request
                    ? "Sur demande"
                    : money(
                        p.unit_price_cents * p.pack_size,
                        catalog.settings.currency,
                      )}
                </output>
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.price_on_request}
                onChange={(e) => set("price_on_request", e.target.checked)}
              />
              Prix sur demande (achat bloqué)
            </label>
            <div className="form-grid">
              <Field label="Dimensions + unité">
                <input
                  maxLength={200}
                  value={p.dimensions}
                  onChange={(e) => set("dimensions", e.target.value)}
                />
              </Field>
              <Field label="Capacité">
                <input
                  maxLength={100}
                  value={p.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Matière">
              <input
                maxLength={100}
                value={p.material}
                onChange={(e) => set("material", e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                maxLength={5000}
                value={p.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
          <div>
            <h3>Photos du produit</h3>
            <div className="editor-image-preview">
              <ProductPhoto image={im} name={p.name || "Aperçu"} />
              {imageIndex === 0 && im && (
                <span className="badge available">Image principale</span>
              )}
            </div>
            <label className="image-upload btn btn-outline">
              {uploading ? <Spinner /> : <ImagePlus size={17} />}Ajouter des
              images
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <small className="muted-copy">
              JPG, PNG, WebP · {imageLimitMo} Mo / fichier. L’original est
              conservé séparément, sans déformation.
            </small>
            {p.images.length > 0 && (
              <>
                <div className="editor-thumbnails">
                  {p.images.map((i, index) => (
                    <button
                      key={i.url + index}
                      type="button"
                      className={imageIndex === index ? "selected" : ""}
                      onClick={() => setImageIndex(index)}
                      aria-label={`Sélectionner l’image ${index + 1}`}
                    >
                      <img src={i.url} alt={`Vue ${index + 1}`} />
                      <span>{index === 0 ? "Principale" : index + 1}</span>
                    </button>
                  ))}
                </div>
                {im && (
                  <div className="image-sliders">
                    <Field label={`Zoom : ${Math.round(im.scale * 100)} %`}>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.01"
                        value={im.scale}
                        onChange={(e) =>
                          updateImage({ scale: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label={`Position verticale : ${im.y} %`}>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={im.y}
                        onChange={(e) =>
                          updateImage({ y: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label={`Position horizontale : ${im.x} %`}>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={im.x}
                        onChange={(e) =>
                          updateImage({ x: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <div className="image-editor-buttons">
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => updateImage({ scale: 1, x: 0, y: 0 })}
                      >
                        <RotateCcw size={13} />
                        Réinitialiser
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Déplacer l’image vers le début"
                        disabled={imageIndex === 0}
                        onClick={() => moveImage(-1)}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Déplacer l’image vers la fin"
                        disabled={imageIndex === p.images.length - 1}
                        onClick={() => moveImage(1)}
                      >
                        <ArrowRight size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label="Retirer cette image du produit"
                        onClick={() => {
                          set(
                            "images",
                            p.images.filter((_, i) => i !== imageIndex),
                          );
                          setImageIndex(Math.max(0, imageIndex - 1));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="link-button"
                      disabled={imageIndex === 0}
                      onClick={() => {
                        const list = [...p.images],
                          first = list.splice(imageIndex, 1)[0];
                        list.unshift(first);
                        set("images", list);
                        setImageIndex(0);
                      }}
                    >
                      Utiliser comme image principale
                    </button>
                  </div>
                )}
              </>
            )}
            {p.source_metadata && (
              <div className="source-info">
                <h4>Informations d’import</h4>
                <p>
                  Ligne {p.source_metadata.row} · Code-barres original :{" "}
                  {p.source_metadata.original_barcode || "absent"}
                </p>
                {p.source_metadata.weight && (
                  <p>
                    Poids source : {p.source_metadata.weight} (unité non
                    précisée dans l’en-tête)
                  </p>
                )}
                {p.source_metadata.notes.map((n, i) => (
                  <p key={i}>{n}</p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-divider" />
        <h3>Disponibilité et mise en avant</h3>
        <div className="editor-checks">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.availability_confirmed}
              onChange={(e) => set("availability_confirmed", e.target.checked)}
            />
            Disponibilité vérifiée
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.available}
              onChange={(e) => {
                set("available", e.target.checked);
                set("availability_confirmed", true);
              }}
            />
            Disponible à la vente
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.is_new}
              onChange={(e) => set("is_new", e.target.checked)}
            />
            Nouveau produit
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.upcoming}
              onChange={(e) => set("upcoming", e.target.checked)}
            />
            Bientôt disponible
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.preorder_enabled}
              onChange={(e) => set("preorder_enabled", e.target.checked)}
            />
            Autoriser la réservation
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.pinned}
              onChange={(e) => set("pinned", e.target.checked)}
            />
            Épingler dans la sélection
          </label>
        </div>
        <div className="form-grid">
          <Field label="Stock en cartons (vide = non géré)">
            <input
              type="number"
              min={0}
              step={1}
              value={p.stock_cartons ?? ""}
              onChange={(e) =>
                set(
                  "stock_cartons",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Ordre manuel (plus petit = avant)">
            <input
              type="number"
              step={1}
              value={p.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="form-divider" />
        <div className="panel-heading">
          <h3>Promotion programmée</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.discount_price_cents !== null}
              onChange={(e) =>
                set(
                  "discount_price_cents",
                  e.target.checked
                    ? Math.round(p.unit_price_cents * 0.9)
                    : null,
                )
              }
            />
            Activer un réglage de remise
          </label>
        </div>
        {p.discount_price_cents !== null && (
          <>
            <div className="form-grid">
              <Field
                label={`Prix unitaire remisé (${catalog.settings.currency})`}
              >
                <input
                  required
                  type="number"
                  min={0}
                  max={p.unit_price_cents / 100}
                  step="0.01"
                  value={p.discount_price_cents / 100}
                  onChange={(e) =>
                    set(
                      "discount_price_cents",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </Field>
              <Field label="Ou remise en pourcentage">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step="0.1"
                  value={
                    p.unit_price_cents
                      ? Math.round(
                          (1 - p.discount_price_cents / p.unit_price_cents) *
                            1000,
                        ) / 10
                      : 0
                  }
                  onChange={(e) =>
                    set(
                      "discount_price_cents",
                      Math.round(
                        p.unit_price_cents * (1 - Number(e.target.value) / 100),
                      ),
                    )
                  }
                />
              </Field>
              <Field label={`Début · ${zone}`}>
                <input
                  required
                  type="datetime-local"
                  value={dateInput(p.discount_start, zone)}
                  onChange={(e) => {
                    try {
                      set("discount_start", dateISO(e.target.value, zone));
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                />
              </Field>
              <Field label={`Fin · ${zone}`}>
                <input
                  required
                  type="datetime-local"
                  value={dateInput(p.discount_end, zone)}
                  onChange={(e) => {
                    try {
                      set("discount_end", dateISO(e.target.value, zone));
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                />
              </Field>
            </div>
            <Field label="Titre de l’offre">
              <input
                value={p.offer_title}
                maxLength={150}
                onChange={(e) => set("offer_title", e.target.value)}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.show_offer}
                onChange={(e) => set("show_offer", e.target.checked)}
              />
              Afficher l’offre sur l’accueil pendant sa période de validité
            </label>
          </>
        )}
        <div className="editor-submit">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={busy || uploading}>
            {busy ? <Spinner /> : <Save size={16} />}Enregistrer le produit
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FamilyManager() {
  const { catalog, refresh, notify } = useStore();
  const [edit, setEdit] = useState<Family | null>(null),
    [target, setTarget] = useState<Family | null>(null),
    [transfer, setTransfer] = useState(""),
    [busy, setBusy] = useState(false);
  if (!catalog) return null;
  const families = [...catalog.families].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const move = (i: number, delta: number) => {
    const other = families[i + delta];
    if (!other) return;
    void action(async () => {
      const ids = families.map((f) => f.id);
      [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
      await api.reorderFamilies(ids);
    });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    await action(async () => {
      await api.saveFamily(edit);
      setEdit(null);
      notify(
        api.previewMode
          ? "Collection modifiée dans l’aperçu."
          : "Collection enregistrée.",
      );
    });
  };
  return (
    <>
      <div className="manager-heading">
        <div>
          <h2>{families.length} collections</h2>
          <p>
            Leur ordre détermine celui des collections et des sélections sur
            l’accueil.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            setEdit({
              id: crypto.randomUUID(),
              name: "",
              name_fr: "",
              image: "",
              visible: true,
              sort_order: Math.max(0, ...families.map((f) => f.sort_order)) + 1,
            })
          }
        >
          <Plus size={17} />
          Créer une collection
        </button>
      </div>
      <div className="family-manager-grid">
        {families.map((f, i) => (
          <article className="panel family-manager-card" key={f.id}>
            <div className="family-manager-image">
              {f.image ? (
                <img src={f.image} alt={f.name} />
              ) : (
                <Grid2X2 size={42} strokeWidth={1} />
              )}
              <span className="family-order">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3>{f.name}</h3>
            <p>
              {catalog.products.filter((p) => p.family_id === f.id).length}{" "}
              références
            </p>
            <div className="family-manager-actions">
              <button
                className="icon-btn"
                disabled={busy}
                aria-label={
                  f.visible ? "Masquer " + f.name : "Afficher " + f.name
                }
                onClick={() =>
                  void action(() =>
                    api.saveFamily({ ...f, visible: !f.visible }),
                  )
                }
              >
                {f.visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              <button
                className="icon-btn"
                disabled={busy || i === 0}
                aria-label={"Monter " + f.name}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                className="icon-btn"
                disabled={busy || i === families.length - 1}
                aria-label={"Descendre " + f.name}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={17} />
              </button>
              <button
                className="icon-btn"
                aria-label={"Modifier " + f.name}
                onClick={() => setEdit({ ...f })}
              >
                <Edit3 size={17} />
              </button>
              <button
                className="icon-btn danger"
                aria-label={"Supprimer " + f.name}
                onClick={() => {
                  setTarget(f);
                  setTransfer("");
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Modal title="Modifier la collection" onClose={() => setEdit(null)}>
          <form onSubmit={(e) => void save(e)}>
            <Field label="Nom de la collection *">
              <input
                required
                value={edit.name}
                maxLength={150}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    name: e.target.value,
                    name_fr: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Image représentative">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const im = await api.uploadProductImage(file);
                    setEdit((prev) =>
                      prev ? { ...prev, image: im.url } : prev,
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Field>
            {edit.image && (
              <img
                className="family-edit-preview"
                src={edit.image}
                alt="Image de la collection"
              />
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={edit.visible}
                onChange={(e) =>
                  setEdit({ ...edit, visible: e.target.checked })
                }
              />
              Afficher dans le magasin
            </label>
            <h3>Diaporama de cette collection</h3>
            <SlideEditor
              familyId={edit.id}
              slides={
                edit.slides === undefined ? familySlides(edit) : edit.slides
              }
              onChange={(slides) => setEdit({ ...edit, slides })}
              height={edit.slider_height || 380}
              onHeight={(slider_height) => setEdit({ ...edit, slider_height })}
            />
            <button className="btn btn-primary full-width" disabled={busy}>
              {busy ? <Spinner /> : <Save size={16} />}Enregistrer
            </button>
          </form>
        </Modal>
      )}
      {target && (
        <Modal title="Supprimer une collection" onClose={() => setTarget(null)}>
          <p>
            Collection « {target.name} » :{" "}
            {catalog.products.filter((p) => p.family_id === target.id).length}{" "}
            produits rattachés.
          </p>
          {catalog.products.some((p) => p.family_id === target.id) && (
            <Field label="Transférer les produits vers *">
              <select
                required
                value={transfer}
                onChange={(e) => setTransfer(e.target.value)}
              >
                <option value="">Choisir une collection de destination</option>
                {families
                  .filter((f) => f.id !== target.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <p className="muted-copy">
            La suppression et le transfert sont exécutés ensemble dans la base
            de données.
          </p>
          <button
            className="btn btn-danger full-width"
            disabled={
              busy ||
              (catalog.products.some((p) => p.family_id === target.id) &&
                !transfer)
            }
            onClick={() =>
              void action(async () => {
                await api.deleteFamily(target.id, transfer || null);
                setTarget(null);
              })
            }
          >
            {busy ? <Spinner /> : <Trash2 size={16} />}Supprimer la collection
          </button>
        </Modal>
      )}
    </>
  );
}
function OrderManager({
  orders,
  reload,
  busy,
}: {
  orders: Order[];
  reload: () => Promise<void>;
  busy: boolean;
}) {
  const { notify } = useStore();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Order | null>(null),
    [changing, setChanging] = useState(false);
  const filtered = orders.filter(
    (o) =>
      (!status || o.status === status) &&
      normalizeSearch(
        `${o.reference} ${o.customer.name} ${o.customer.phone}`,
      ).includes(normalizeSearch(q)),
  );
  const change = async (order: Order, value: string) => {
    setChanging(true);
    try {
      await api.changeOrderStatus(order.id, value as Order["status"]);
      await reload();
      if (selected?.id === order.id)
        setSelected({ ...order, status: value as Order["status"] });
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setChanging(false);
    }
  };
  return (
    <>
      <div className="manager-heading">
        <div>
          <h2>Suivre chaque commande</h2>
          <p>
            Les données et tarifs de chaque bon restent ceux enregistrés lors de
            sa création.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => void reload()}>
          Actualiser
        </button>
      </div>
      <div className="panel">
        <div className="manager-toolbar">
          <div className="catalog-search">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Rechercher une commande"
              placeholder="Référence, client, téléphone…"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrer les commandes par statut"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(ORDER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {busy ? (
          <div className="loading-state">
            <Spinner />
            Chargement…
          </div>
        ) : filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Cartons / unités</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.reference}</b>
                      {o.preview && (
                        <small className="amber-text">APERÇU</small>
                      )}
                    </td>
                    <td>
                      {o.customer.name}
                      <small>
                        {o.customer.phone} · {o.customer.wilaya}
                      </small>
                    </td>
                    <td>
                      {new Date(o.created_at).toLocaleDateString("fr-DZ")}
                    </td>
                    <td>
                      {o.items.reduce((s, i) => s + i.cartons, 0)} /{" "}
                      {o.items.reduce((s, i) => s + i.total_units, 0)}
                    </td>
                    <td>{money(o.total_cents, o.currency)}</td>
                    <td>
                      <select
                        value={o.status}
                        aria-label={"Statut de " + o.reference}
                        disabled={changing}
                        onChange={(e) => void change(o, e.target.value)}
                      >
                        {Object.entries(ORDER_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={"Consulter " + o.reference}
                        onClick={() => setSelected(o)}
                      >
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Aucune commande correspondante"
            body="Les commandes enregistrées s’afficheront dans cette liste."
          />
        )}
      </div>
      {selected && (
        <Modal
          title={selected.reference}
          onClose={() => setSelected(null)}
          wide
        >
          <InvoiceActions order={selected} />
          <InvoicePaper order={selected} />
        </Modal>
      )}
    </>
  );
}
function RequestManager({
  requests,
  reload,
  busy,
}: {
  requests: RequestRecord[];
  reload: () => Promise<void>;
  busy: boolean;
}) {
  const { catalog, notify } = useStore();
  const [kind, setKind] = useState(""),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<RequestRecord | null>(null),
    [links, setLinks] = useState<Record<string, string>>({});
  const filtered = requests.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      normalizeSearch(
        `${r.reference} ${r.customer.name} ${r.customer.phone}`,
      ).includes(normalizeSearch(q)),
  );
  const change = async (r: RequestRecord, status: RequestRecord["status"]) => {
    try {
      await api.changeRequestStatus(r.id, status);
      await reload();
      if (selected?.id === r.id) setSelected({ ...r, status });
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const prepareLink = async (path: string) => {
    try {
      const url = await api.referenceLink(path);
      setLinks((prev) => ({ ...prev, [path]: url }));
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <>
      <div className="manager-heading">
        <div>
          <h2>Réservations & fabrication sur mesure</h2>
          <p>
            Ces demandes sont distinctes des ventes et n’augmentent pas le
            chiffre d’affaires.
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="manager-toolbar">
          <div className="catalog-search">
            <Search size={17} />
            <input
              aria-label="Rechercher une demande"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Référence, nom, téléphone…"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Type de demande"
          >
            <option value="">Tous les types</option>
            <option value="preorder">Réservation</option>
            <option value="custom">Fabrication / demande spéciale</option>
          </select>
        </div>
        {busy ? (
          <div className="loading-state">
            <Spinner />
            Chargement…
          </div>
        ) : filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Quantité</th>
                  <th>Statut</th>
                  <th>Consulter</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reference}</td>
                    <td>
                      {r.kind === "preorder"
                        ? "Réservation"
                        : "Fabrication / demande"}
                    </td>
                    <td>
                      {r.customer.name}
                      <small>{r.customer.phone}</small>
                    </td>
                    <td>
                      {r.kind === "preorder"
                        ? `${r.cartons} cartons`
                        : r.details.quantity}
                    </td>
                    <td>
                      <select
                        aria-label={"Statut de " + r.reference}
                        value={r.status}
                        onChange={(e) =>
                          void change(
                            r,
                            e.target.value as RequestRecord["status"],
                          )
                        }
                      >
                        {Object.entries(REQUEST_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={"Détails de " + r.reference}
                        onClick={() => {
                          setSelected(r);
                          setLinks({});
                        }}
                      >
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Aucune demande pour le moment"
            body="Les réservations et projets enregistrés seront présentés ici."
          />
        )}
      </div>
      {selected && (
        <Modal
          title={selected.reference}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="request-details">
            <div>
              <span className="eyebrow">COORDONNÉES</span>
              <h3>{selected.customer.name}</h3>
              <p>{selected.customer.phone}</p>
              <p>{selected.customer.email}</p>
              <p>
                {selected.customer.wilaya} {selected.customer.address}
              </p>
              <p>{selected.customer.notes}</p>
            </div>
            <div>
              <span className="eyebrow">LA DEMANDE</span>
              {selected.kind === "preorder" && (
                <p>
                  <b>
                    {catalog?.products.find((p) => p.id === selected.product_id)
                      ?.name || "Produit réservé"}
                  </b>{" "}
                  · {selected.cartons} cartons
                </p>
              )}
              <p>{selected.details.description}</p>
              <dl className="detail-spec-table">
                {[
                  ["Dimensions", selected.details.dimensions],
                  ["Capacité", selected.details.capacity],
                  ["Couleur", selected.details.color],
                  ["Matière", selected.details.material],
                  ["Quantité", selected.details.quantity],
                ].map(([l, v]) => (
                  <div key={l}>
                    <dt>{l}</dt>
                    <dd>{v || "Non précisé"}</dd>
                  </div>
                ))}
              </dl>
              {selected.details.attachments.map((path, i) => (
                <div className="request-attachment" key={path}>
                  {links[path] ? (
                    <a
                      href={links[path]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir la référence {i + 1} <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <button
                      className="text-link"
                      onClick={() => void prepareLink(path)}
                    >
                      Préparer le lien privé de la référence {i + 1}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="notice amber">
            Aucun tarif ni accord de fabrication n’est créé automatiquement par
            cette demande.
          </p>
        </Modal>
      )}
    </>
  );
}
function SettingsManager() {
  const { catalog, notify, refresh } = useStore();
  const [s, setS] = useState<Settings>(structuredClone(catalog!.settings)),
    [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveSettings(s);
      await refresh();
      notify(
        api.previewMode
          ? "Réglages mis à jour dans l’aperçu."
          : "Réglages enregistrés.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const heroChange = (
    index: number,
    key: keyof Hero,
    value: string | boolean,
  ) =>
    set(
      "heroes",
      s.heroes.map((h, i) => (i === index ? { ...h, [key]: value } : h)),
    );
  const move = (i: number, delta: number) => {
    const a = [...s.heroes],
      j = i + delta;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set("heroes", a);
  };
  const uploadSettingImage = async (file: File, index?: number) => {
    setBusy(true);
    try {
      const im = await api.uploadProductImage(file);
      if (index === undefined) set("logo_url", im.url);
      else heroChange(index, "image", im.url);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form
        onSubmit={(e) => void save(e)}
        className="settings-form"
        autoComplete="off"
      >
        <AdvancedSettings s={s} onChange={setS} />
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
        </section>
        <section className="panel">
          <h2>Commandes, devise et fuseau horaire</h2>
          <div className="form-grid">
            <Field label="Devise (code ISO)">
              <input
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                value={s.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
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
        </section>
        <VisualSettings s={s} onChange={setS} />
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
        </section>
        <div className="settings-save">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <Save size={17} />}Enregistrer les réglages
          </button>
        </div>
      </form>
      <AdminPasswordSettings />
    </>
  );
}
