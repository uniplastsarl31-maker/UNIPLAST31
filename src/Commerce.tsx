import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Info,
  LoaderCircle,
  Package,
  Paperclip,
  Printer,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Share2,
} from "lucide-react";
import type { Customer, Order, Product } from "./types";
import { canBuy, cartTotals, money, ORDER_LABELS } from "./domain";
import { navigate, useStore } from "./store";
import { Empty, Field, ProductPhoto, Quantity, Spinner } from "./ui";
import * as api from "./api";
import { createOrderPdf } from "./pdf";

const blankCustomer: Customer = {
  name: "",
  phone: "",
  wilaya: "",
  address: "",
  notes: "",
};
export function CustomerFields({
  value,
  onChange,
  full = true,
}: {
  value: Customer;
  onChange: (c: Customer) => void;
  full?: boolean;
}) {
  const set = (key: keyof Customer, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <>
      <div className="form-grid">
        <Field label="Nom complet / entreprise *">
          <input
            autoComplete="name"
            required
            minLength={2}
            maxLength={150}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Votre nom ou raison sociale"
          />
        </Field>
        <Field label="Téléphone *">
          <input
            type="tel"
            autoComplete="tel"
            required
            pattern="[+0-9 ()\-]{8,25}"
            maxLength={25}
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="Ex. 05 00 00 00 00"
          />
        </Field>
        {full && (
          <>
            <Field label="Wilaya *">
              <input
                autoComplete="address-level1"
                required
                maxLength={100}
                value={value.wilaya}
                onChange={(e) => set("wilaya", e.target.value)}
                placeholder="Votre wilaya"
              />
            </Field>
            <Field label="Adresse complète *">
              <input
                autoComplete="street-address"
                required
                minLength={5}
                maxLength={500}
                value={value.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Commune, rue, bâtiment…"
              />
            </Field>
          </>
        )}
      </div>
      <Field label="Notes complémentaires">
        <textarea
          rows={3}
          maxLength={2000}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Une précision utile pour votre demande ?"
        />
      </Field>
    </>
  );
}
export function InvoicePaper({ order }: { order: Order }) {
  return (
    <div className="invoice-paper" id="invoice-paper">
      <div className="invoice-header" data-pdf-block>
        <div>
          <img
            src={order.company_snapshot.logo_url}
            alt={order.company_snapshot.company_name}
          />
          <p>{order.company_snapshot.address}</p>
          {order.company_snapshot.phone && (
            <p>Tél. {order.company_snapshot.phone}</p>
          )}
          {order.company_snapshot.email && (
            <p>{order.company_snapshot.email}</p>
          )}
        </div>
        <div className="invoice-heading">
          <span>BON DE COMMANDE</span>
          <h2>{order.reference}</h2>
          <p>
            {new Intl.DateTimeFormat("fr-DZ", {
              dateStyle: "long",
              timeStyle: "short",
              hour12: false,
              timeZone: order.company_snapshot.timezone || "Africa/Algiers",
            }).format(new Date(order.created_at))}
          </p>
          <span className={`badge ${order.preview ? "unknown" : "available"}`}>
            {order.preview
              ? "APERÇU — NON TRANSMIS"
              : ORDER_LABELS[order.status]}
          </span>
        </div>
      </div>
      {order.preview && (
        <p className="invoice-preview-note" data-pdf-block>
          Document de prévisualisation. Aucune commande n’a été enregistrée dans
          une base de données ni transmise à UNIPLAST.
        </p>
      )}
      <div className="invoice-customer" data-pdf-block>
        <span>COORDONNÉES DU CLIENT</span>
        <h3>{order.customer.name}</h3>
        <p>{order.customer.phone}</p>
        <p>
          {order.customer.wilaya} · {order.customer.address}
        </p>
        {order.customer.notes && <p>Notes : {order.customer.notes}</p>}
      </div>
      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr data-pdf-block>
              <th>Produit</th>
              <th>Réf.</th>
              <th>Prix unité</th>
              <th>Colisage</th>
              <th>Cartons</th>
              <th>Unités</th>
              <th>Remise</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line, i) => (
              <tr key={line.product_id + String(i)} data-pdf-block>
                <td>{line.name}</td>
                <td className="mono">{line.code}</td>
                <td>{money(line.unit_price_cents, order.currency)}</td>
                <td>{line.pack_size}</td>
                <td>{line.cartons}</td>
                <td>{line.total_units}</td>
                <td>{money(line.discount_cents, order.currency)}</td>
                <td>
                  <b>{money(line.total_cents, order.currency)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="invoice-totals-block" data-pdf-block>
        <div className="invoice-notes">
          <b>Une commande en toute clarté.</b>
          <p>
            {order.company_snapshot.tax_note ||
              "Informations fiscales non renseignées."}
          </p>
          <p>
            Le prix du carton correspond au prix unitaire après remise ×
            colisage. Les réservations et demandes de fabrication font l’objet
            d’un traitement séparé.
          </p>
        </div>
        <dl className="totals">
          <div>
            <dt>Sous-total avant remises</dt>
            <dd>{money(order.subtotal_cents, order.currency)}</dd>
          </div>
          <div>
            <dt>Remises</dt>
            <dd>− {money(order.discount_cents, order.currency)}</dd>
          </div>
          <div>
            <dt>Livraison / supplément paramétré</dt>
            <dd>{money(order.shipping_cents, order.currency)}</dd>
          </div>
          <div className="grand-total">
            <dt>Total</dt>
            <dd>{money(order.total_cents, order.currency)}</dd>
          </div>
        </dl>
      </div>
      <div className="invoice-end" data-pdf-block>
        <span>{order.company_snapshot.company_name}</span>
        <span>
          {order.items.reduce((n, i) => n + i.cartons, 0)} cartons ·{" "}
          {order.items.reduce((n, i) => n + i.total_units, 0)} unités
        </span>
      </div>
    </div>
  );
}
export function InvoiceActions({ order }: { order: Order }) {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );
  useEffect(() => {
    setPdfUrl("");
    setPdfFile(null);
  }, [order.id]);
  const pdf = async () => {
    setBusy(true);
    try {
      const node = document.getElementById("invoice-paper");
      if (!node) throw new Error("Document introuvable.");
      const blob = await createOrderPdf(node, order.reference);
      setPdfFile(
        new File([blob], `${order.reference}.pdf`, { type: "application/pdf" }),
      );
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      notify("Export PDF impossible : " + (e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const print = () => {
    document.body.classList.add("printing-invoice");
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("printing-invoice"),
      { once: true },
    );
    window.print();
  };
  const summary = `${order.preview ? "APERÇU — " : ""}${order.company_snapshot.company_name} · Bon de commande ${order.reference} · ${money(order.total_cents, order.currency)}. Je vous transmets le PDF séparément.`;
  const viberSummary = `${order.preview ? "APERÇU · " : ""}${order.reference} · ${money(order.total_cents, order.currency)}. PDF joint séparément.`;
  const share = async () => {
    if (!pdfFile) return;
    try {
      if (!navigator.canShare?.({ files: [pdfFile] }) || !navigator.share) {
        notify(
          "Téléchargez le PDF, puis joignez-le dans WhatsApp ou Viber. Le partage de fichiers n’est pas disponible dans ce navigateur.",
        );
        return;
      }
      await navigator.share({
        files: [pdfFile],
        title: order.reference,
        text: summary,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        notify(
          "Partage indisponible. Téléchargez le PDF et joignez-le dans votre messagerie.",
          true,
        );
    }
  };
  return (
    <div className="invoice-actions print-hide">
      <button className="btn btn-outline" onClick={print}>
        <Printer size={17} />
        Imprimer
      </button>
      {pdfUrl ? (
        <a
          className="btn btn-primary"
          href={pdfUrl}
          download={`${order.reference}.pdf`}
        >
          <Download size={17} />
          Télécharger le PDF
        </a>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => void pdf()}
          disabled={busy}
        >
          {busy ? <Spinner /> : <Download size={17} />}
          {busy ? "Préparation du PDF…" : "Préparer le PDF"}
        </button>
      )}
      {pdfFile && (
        <button className="btn btn-outline" onClick={() => void share()}>
          <Share2 size={17} /> Partager le PDF · WhatsApp / Viber
        </button>
      )}
      <div className="invoice-share">
        <span>Transmettre ce bon :</span>
        <a
          className="text-link"
          href={"https://wa.me/?text=" + encodeURIComponent(summary)}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp · résumé ↗
        </a>
        <a
          className="text-link"
          href={"viber://forward?text=" + encodeURIComponent(viberSummary)}
        >
          Viber · résumé ↗
        </a>
        <small>
          Préparez le PDF, puis partagez-le ou joignez-le au message. Aucun
          document n’est envoyé automatiquement.
        </small>
      </div>
    </div>
  );
}
export function Checkout() {
  const {
    catalog,
    cart,
    setQuantity,
    removeCart,
    checkoutKey,
    emptyCart,
    refresh,
    notify,
  } = useStore();
  const [customer, setCustomer] = useState<Customer>(blankCustomer),
    [busy, setBusy] = useState(false),
    [order, setOrder] = useState<Order | null>(null),
    [accepted, setAccepted] = useState(false);
  const lock = useRef(false);
  if (!catalog) return null;
  if (order)
    return (
      <main className="container page">
        <div
          className={`order-confirmation ${order.preview ? "is-preview" : ""}`}
        >
          <span>
            {order.preview ? <Info size={30} /> : <CheckCircle2 size={30} />}
          </span>
          <div>
            <h1>
              {order.preview
                ? "Votre bon d’aperçu est prêt."
                : "Votre commande a bien été enregistrée."}
            </h1>
            <p>
              {order.preview
                ? "Aucun envoi ni enregistrement réel. Cette simulation reste disponible jusqu’au rechargement."
                : `Conservez votre référence ${order.reference}. UNIPLAST examinera votre demande.`}
            </p>
          </div>
        </div>
        <div className="receipt-links print-hide">
          <a href="#/catalogue" className="text-link">
            <ArrowLeft size={16} />
            Continuer mes achats
          </a>
          <a href="#/mes-commandes" className="text-link">
            Mes commandes <ArrowRight size={16} />
          </a>
          <InvoiceActions order={order} />
        </div>
        <InvoicePaper order={order} />
      </main>
    );
  if (!cart.length)
    return (
      <main className="container page">
        <Empty
          title="Votre panier attend vos idées."
          body="Explorez nos collections et choisissez les produits qui vous conviennent."
        >
          <a className="btn btn-primary" href="#/catalogue">
            Explorer le catalogue <ArrowRight size={17} />
          </a>
        </Empty>
      </main>
    );
  if (
    cart.some(
      (i) => catalog.products.find((p) => p.id === i.product_id)?.price_hidden,
    )
  )
    return (
      <main className="container page">
        <Empty
          title="Connectez-vous pour retrouver vos tarifs."
          body="Les commandes sont réservées aux clients agréés. Votre sélection de produits est conservée."
        >
          <a className="btn btn-primary" href="#/client-agree">
            Client agréé
          </a>
        </Empty>
      </main>
    );
  const s = catalog.settings,
    totals = cartTotals(cart, catalog.products, s.shipping_cents);
  const issues = cart.some((i) => {
    const p = catalog.products.find((p) => p.id === i.product_id);
    return (
      !p ||
      !canBuy(p) ||
      !catalog.families.some((f) => f.id === p.family_id && f.visible) ||
      (p.stock_cartons !== null && i.cartons > p.stock_cartons)
    );
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!accepted) throw new Error("Acceptez les conditions de commande.");
      if (issues)
        throw new Error(
          "Mettez à jour les produits indisponibles avant de continuer.",
        );
      const saved = await api.placeOrder(
        cart,
        catalog.products,
        customer,
        s,
        checkoutKey,
      );
      setOrder(saved);
      emptyCart();
      void refresh();
    } catch (e) {
      notify((e as Error).message, true);
      await refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="#/">Accueil</a>
        <ChevronRight size={12} />
        <span>Mon panier</span>
      </div>
      <div className="page-heading">
        <span className="eyebrow">CHAQUE DÉTAIL COMPTE</span>
        <h1>Votre sélection, en toute clarté.</h1>
        <p>
          {totals.cartons} cartons · {totals.units} unités · {cart.length}{" "}
          références
        </p>
      </div>
      <form onSubmit={(e) => void submit(e)} className="checkout-layout">
        <div>
          <section className="panel cart-panel">
            <div className="panel-heading">
              <h2>Votre panier</h2>
              <a className="text-link" href="#/catalogue">
                Ajouter un produit <ArrowRight size={15} />
              </a>
            </div>
            {cart.map((item) => {
              const p = catalog.products.find((p) => p.id === item.product_id),
                line = totals.lines.find(
                  (i) => i.product_id === item.product_id,
                );
              return (
                <div className="cart-row" key={item.product_id}>
                  {p && <ProductPhoto image={p.images[0]} name={p.name} />}
                  <div className="cart-row-info">
                    <a href={"#/produit/" + item.product_id}>
                      {p?.name || "Produit retiré du catalogue"}
                    </a>
                    <span>
                      Réf. {p?.code || "—"} · {p?.pack_size} unités /{" "}
                      {p?.pack_label}
                    </span>
                    {line && (
                      <small>
                        {money(line.unit_price_cents, s.currency)} / unité ·{" "}
                        {money(line.carton_price_cents, s.currency)} / carton
                      </small>
                    )}
                    {(!p ||
                      !canBuy(p) ||
                      !catalog.families.some(
                        (f) => f.id === p.family_id && f.visible,
                      ) ||
                      (p.stock_cartons !== null &&
                        item.cartons > p.stock_cartons)) && (
                      <b className="error-text">
                        Produit ou quantité indisponible
                      </b>
                    )}
                  </div>
                  <div className="cart-row-qty">
                    <Quantity
                      value={item.cartons}
                      onChange={(n) => setQuantity(item.product_id, n)}
                    />
                    <small>{(p?.pack_size || 0) * item.cartons} unités</small>
                  </div>
                  <strong>
                    {line ? money(line.total_cents, s.currency) : "—"}
                  </strong>
                  <button
                    type="button"
                    className="icon-btn remove-item"
                    onClick={() => removeCart(item.product_id)}
                    aria-label={`Retirer ${p?.name || "ce produit"}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
            <div className="cart-formula">
              <Info size={16} />
              <span>
                Nombre de cartons × colisage = total d’unités. Le tarif du
                carton est calculé automatiquement.
              </span>
            </div>
          </section>
          <section className="panel checkout-form">
            <div className="panel-heading">
              <h2>Vos coordonnées</h2>
              <span>Champs obligatoires *</span>
            </div>
            <CustomerFields value={customer} onChange={setCustomer} />
          </section>
        </div>
        <aside className="checkout-summary panel">
          <span className="eyebrow">LE RÉCAPITULATIF</span>
          <h2>Votre commande</h2>
          <dl className="totals">
            <div>
              <dt>Sous-total</dt>
              <dd>{money(totals.subtotal, s.currency)}</dd>
            </div>
            <div>
              <dt>Remises</dt>
              <dd className="success-text">
                − {money(totals.discount, s.currency)}
              </dd>
            </div>
            <div>
              <dt>Supplément livraison</dt>
              <dd>{money(totals.shipping, s.currency)}</dd>
            </div>
            <div className="grand-total">
              <dt>Total</dt>
              <dd>{money(totals.total, s.currency)}</dd>
            </div>
          </dl>
          <p className="tax-note">{s.tax_note}</p>
          {api.previewMode && (
            <p className="notice amber">
              <Info size={17} />
              Mode aperçu : ce document ne sera pas envoyé à UNIPLAST.
            </p>
          )}
          <label className="checkbox">
            <input
              required
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              J’accepte les{" "}
              <a href="#/conditions" target="_blank">
                conditions de commande
              </a>{" "}
              et le traitement de mes coordonnées pour cette demande.
            </span>
          </label>
          <button
            className="btn btn-primary checkout-submit"
            disabled={busy || issues}
          >
            {busy ? <Spinner /> : <ShieldCheck size={17} />}{" "}
            {busy
              ? "Vérification en cours…"
              : api.previewMode
                ? "Générer le bon d’aperçu"
                : "Confirmer ma commande"}
          </button>
          <span className="secure-note">
            {api.previewMode
              ? "Aucun paiement. Aucun envoi réel."
              : "Aucun paiement en ligne demandé."}
          </span>
          <button
            type="button"
            className="refresh-cart"
            onClick={() => void refresh()}
          >
            <RefreshCw size={13} />
            Actualiser les prix et le stock
          </button>
        </aside>
      </form>
    </main>
  );
}
export function MyOrders({ id }: { id?: string }) {
  const { notify, repeatOrder } = useStore();
  const [orders, setOrders] = useState<Order[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    setBusy(true);
    try {
      setOrders(await api.listOrders());
      setError("");
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  if (busy)
    return (
      <main className="container page loading-state">
        <Spinner />
        Chargement de vos commandes…
      </main>
    );
  const found = id ? orders.find((o) => o.id === id) : null;
  return (
    <main className="container page">
      {found ? (
        <>
          <div className="receipt-links">
            <a className="text-link" href="#/mes-commandes">
              <ArrowLeft size={16} />
              Mes commandes
            </a>
            <InvoiceActions order={found} />
            <button
              className="btn btn-outline"
              onClick={() => repeatOrder(found)}
            >
              <RefreshCw size={17} /> Reprendre cette sélection
            </button>
            <small className="repeat-note">
              Remplace le panier actuel. Les prix, colisages et quantités
              disponibles seront ceux du catalogue actuel.
            </small>
          </div>
          <InvoicePaper order={found} />
        </>
      ) : (
        <>
          <div className="page-heading">
            <span className="eyebrow">VOTRE ESPACE</span>
            <h1>Mes commandes</h1>
            <p>Vos commandes et PDF associés à votre accès client.</p>
            <a className="text-link" href="#/client-agree">
              Mon accès client · téléphone et code →
            </a>
          </div>
          {error ? (
            <Empty title="Chargement impossible" body={error}>
              <button className="btn btn-primary" onClick={() => void load()}>
                Réessayer
              </button>
            </Empty>
          ) : orders.length ? (
            <div className="orders-grid">
              {orders.map((o) => (
                <a
                  className="order-list-card"
                  key={o.id}
                  href={"#/bon/" + o.id}
                >
                  <span className="order-file-icon">
                    <FileText size={24} />
                  </span>
                  <div>
                    <strong>{o.reference}</strong>
                    <span>
                      {new Date(o.created_at).toLocaleDateString("fr-DZ")} ·{" "}
                      {o.items.length} références
                    </span>
                  </div>
                  <span className="badge unknown">
                    {o.preview ? "Aperçu" : ORDER_LABELS[o.status]}
                  </span>
                  <b>{money(o.total_cents, o.currency)}</b>
                  <ArrowUpRightIcon />
                </a>
              ))}
            </div>
          ) : (
            <Empty
              title={
                id
                  ? "Ce bon n’est pas accessible."
                  : "Aucune commande pour le moment."
              }
              body="Entrez votre téléphone et votre code UNIPLAST pour retrouver les commandes associées à votre accès, y compris sur un autre appareil. Les commandes passées en invité restent sur le navigateur d’origine."
            >
              <a className="btn btn-primary" href="#/catalogue">
                Découvrir le catalogue
              </a>
            </Empty>
          )}
        </>
      )}
    </main>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={18} />;
}
export function RequestForm({ product }: { product?: Product }) {
  const { notify, catalog } = useStore();
  const [customer, setCustomer] = useState<Customer>(blankCustomer),
    [email, setEmail] = useState(""),
    [description, setDescription] = useState(""),
    [dimensions, setDimensions] = useState(""),
    [capacity, setCapacity] = useState(""),
    [color, setColor] = useState(""),
    [material, setMaterial] = useState(""),
    [quantity, setQuantity] = useState(""),
    [cartons, setCartons] = useState(1),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState("");
  const requestKey = useRef(crypto.randomUUID()),
    lock = useRef(false);
  const queryProduct = new URLSearchParams(
      window.location.hash.split("?")[1],
    ).get("produit"),
    requested = catalog?.products.find((p) => p.id === queryProduct);
  useEffect(() => {
    if (requested)
      setDescription(
        `Demande de renseignements concernant ${requested.name}, référence ${requested.code}.`,
      );
  }, [requested?.id]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (product && (!product.upcoming || !product.preorder_enabled))
        throw new Error("La précommande n’est pas ouverte pour ce produit.");
      const attachments = [];
      for (const file of files)
        attachments.push(await api.uploadReference(file));
      const result = await api.submitRequest(
        {
          kind: product ? "preorder" : "custom",
          product_id: product?.id || null,
          customer: { ...customer, email },
          cartons: product ? cartons : 0,
          details: {
            description,
            dimensions,
            capacity,
            color,
            material,
            quantity: product ? `${cartons} cartons` : quantity,
            attachments,
          },
        },
        requestKey.current,
      );
      setReference(result.reference);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  if (reference)
    return (
      <main className="container page">
        <Empty
          title={
            api.previewMode
              ? "Votre demande d’aperçu est prête."
              : "Votre demande a été enregistrée."
          }
          body={
            api.previewMode
              ? `Référence ${reference}. Aucun envoi réel. Les données restent en mémoire jusqu’au rechargement.`
              : `Référence ${reference}. Votre projet est en attente de revue. Aucun prix ni engagement de fabrication n’est confirmé.`
          }
        >
          <a className="btn btn-primary" href="#/catalogue">
            Retour au catalogue
          </a>
        </Empty>
      </main>
    );
  return (
    <main className="container page request-page">
      <div className="page-heading">
        <span className="eyebrow">
          {product
            ? "PRENEZ UNE LONGUEUR D’AVANCE"
            : "VOTRE PROJET COMMENCE ICI"}
        </span>
        <h1>{product ? "Réserver un produit" : "Imaginons votre solution."}</h1>
        <p>
          {product
            ? product.name
            : "Une forme, un usage, une idée particulière ? Présentez-nous votre besoin."}
        </p>
      </div>
      <div className="request-layout">
        <form className="panel request-form" onSubmit={(e) => void submit(e)}>
          <h2>Vos coordonnées</h2>
          <CustomerFields
            value={customer}
            onChange={setCustomer}
            full={!!product}
          />
          <Field label="E-mail (facultatif)">
            <input
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div className="form-divider" />
          <h2>
            {product ? "Votre réservation" : "Les détails de votre projet"}
          </h2>
          {product ? (
            <Field label="Nombre de cartons *">
              <Quantity value={cartons} onChange={setCartons} />
            </Field>
          ) : (
            <>
              <Field label="Description du produit souhaité *">
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l’usage, la forme et les caractéristiques recherchées…"
                />
              </Field>
              <div className="form-grid">
                <Field label="Dimensions souhaitées">
                  <input
                    value={dimensions}
                    maxLength={200}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder="Longueur × largeur × hauteur + unité"
                  />
                </Field>
                <Field label="Capacité">
                  <input
                    value={capacity}
                    maxLength={100}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Ex. 2 L"
                  />
                </Field>
                <Field label="Couleur">
                  <input
                    value={color}
                    maxLength={100}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </Field>
                <Field label="Matière">
                  <input
                    value={material}
                    maxLength={100}
                    onChange={(e) => setMaterial(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Quantité souhaitée *">
                <input
                  required
                  value={quantity}
                  maxLength={100}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Précisez la quantité et l’unité"
                />
              </Field>
              <label className="file-drop">
                <Paperclip size={24} />
                <b>Ajouter des références</b>
                <span>
                  JPG, PNG, WebP, PDF · 5 Mo maximum par fichier · 4 fichiers
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  onChange={(e) => {
                    const fs = Array.from(e.target.files || []);
                    if (
                      fs.length > 4 ||
                      fs.some((f) => f.size > 5 * 1024 * 1024)
                    ) {
                      notify("4 fichiers maximum, 5 Mo par fichier.", true);
                      e.target.value = "";
                      return;
                    }
                    setFiles(fs);
                  }}
                />
              </label>
              {files.map((f, i) => (
                <div className="attachment-name" key={i}>
                  <Paperclip size={13} />
                  {f.name}
                  <button
                    type="button"
                    aria-label={"Retirer " + f.name}
                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
          {api.previewMode && (
            <p className="notice amber">
              <Info size={17} />
              Cette demande restera une simulation dans le mode aperçu.
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <ArrowRight size={17} />}{" "}
            {busy
              ? "Enregistrement…"
              : api.previewMode
                ? "Créer la demande d’aperçu"
                : "Envoyer ma demande"}
          </button>
        </form>
        <aside className="request-aside">
          <span className="request-aside-icon">
            <Package size={36} strokeWidth={1} />
          </span>
          <h2>
            De votre idée
            <br />à notre étude.
          </h2>
          <div>
            <span>01</span>
            <p>Décrivez votre besoin et joignez vos références.</p>
          </div>
          <div>
            <span>02</span>
            <p>Notre équipe examine les possibilités de fabrication.</p>
          </div>
          <div>
            <span>03</span>
            <p>Vous échangez avec UNIPLAST sur les suites possibles.</p>
          </div>
          <p className="request-aside-note">
            L’envoi d’une demande ne confirme ni un prix ni la faisabilité de la
            fabrication. Les réservations sont distinctes des ventes.
          </p>
        </aside>
      </div>
    </main>
  );
}
