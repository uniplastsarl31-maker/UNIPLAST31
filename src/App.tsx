import { AboutPage, Suggestions } from "./Experience";
import { Component, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { StoreProvider, useRoute, useStore } from "./store";
import {
  Header,
  Footer,
  Home,
  Catalogue,
  ProductDetails,
  Collections,
} from "./Storefront";
import { Checkout, MyOrders, RequestForm } from "./Commerce";
import { Admin } from "./Admin";
import {
  CartDialogs,
  LoginDialog,
  PasswordRecovery,
  ScannerDialog,
} from "./Dialogs";
import { Empty, Modal, Spinner } from "./ui";
import { CustomerAccount } from "./CustomerFeatures";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="container page">
        <Empty
          title="Un problème a interrompu l’affichage."
          body="Rechargez la page. Le panier enregistré dans ce navigateur sera conservé."
        >
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </Empty>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Router() {
  const route = useRoute(),
    { catalog, loading, error, refresh, toast } = useStore();
  const [login, setLogin] = useState(false),
    [scanner, setScanner] = useState(false),
    [policy, setPolicy] = useState<"privacy" | "terms" | null>(null);
  const [path, query = ""] = route.split("?"),
    params = new URLSearchParams(query);
  if (loading)
    return (
      <div className="initial-loading">
        <img src="/assets/uniplast-logo.png" alt="UNIPLAST" />
        <Spinner />
        <p>Votre catalogue se prépare…</p>
      </div>
    );
  if (!catalog)
    return (
      <main className="container page">
        <Empty
          title="Le catalogue n’est pas accessible."
          body={error || "Vérifiez la configuration du service."}
        >
          <button className="btn btn-primary" onClick={() => void refresh()}>
            Réessayer
          </button>
        </Empty>
      </main>
    );
  let content: ReactNode;
  if (path === "/") content = <Home />;
  else if (path === "/a-propos") content = <AboutPage />;
  else if (path === "/suggestions") content = <Suggestions />;
  else if (path === "/client-agree") content = <CustomerAccount />;
  else if (path === "/catalogue") content = <Catalogue params={params} />;
  else if (path === "/collections") content = <Collections />;
  else if (path.startsWith("/produit/"))
    content = <ProductDetails id={path.slice(9)} />;
  else if (path === "/panier") content = <Checkout />;
  else if (path === "/sur-mesure") content = <RequestForm />;
  else if (path.startsWith("/reservation/")) {
    const product = catalog.products.find((p) => p.id === path.slice(13));
    content =
      product?.upcoming && product.preorder_enabled ? (
        <RequestForm key={product.id} product={product} />
      ) : (
        <main className="container page">
          <Empty
            title="Réservation non disponible"
            body="La réservation n’est pas activée pour ce produit."
          >
            <a className="btn btn-primary" href="#/catalogue">
              Retour au catalogue
            </a>
          </Empty>
        </main>
      );
  } else if (path === "/mes-commandes") content = <MyOrders />;
  else if (path.startsWith("/bon/")) content = <MyOrders id={path.slice(5)} />;
  else if (path === "/admin")
    content = <Admin openLogin={() => setLogin(true)} />;
  else if (path === "/nouveau-mot-de-passe") content = <PasswordRecovery />;
  else if (path === "/conditions" || path === "/confidentialite")
    content = (
      <main className="container page policy-page">
        <span className="eyebrow">UNIPLAST</span>
        <h1>
          {path === "/conditions"
            ? "Conditions de commande"
            : "Confidentialité"}
        </h1>
        <p>
          {path === "/conditions"
            ? catalog.settings.terms
            : catalog.settings.privacy}
        </p>
      </main>
    );
  else
    content = (
      <main className="container page">
        <Empty
          title="Cette page n’existe pas."
          body="Revenez au catalogue pour poursuivre votre visite."
        >
          <a className="btn btn-primary" href="#/catalogue">
            Explorer le catalogue
          </a>
        </Empty>
      </main>
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Aller au contenu
      </a>
      <Header
        openLogin={() => setLogin(true)}
        openScanner={() => setScanner(true)}
      />
      {error && (
        <div className="catalog-update-error">
          La dernière mise à jour a échoué. Les données affichées peuvent avoir
          changé. <button onClick={() => void refresh()}>Réessayer</button>
        </div>
      )}
      <div id="main-content" tabIndex={-1}>
        {content}
      </div>
      <Footer openPolicy={setPolicy} />
      {login && <LoginDialog onClose={() => setLogin(false)} />}
      {scanner && <ScannerDialog onClose={() => setScanner(false)} />}
      {policy && (
        <Modal
          title={
            policy === "privacy"
              ? "Politique de confidentialité"
              : "Conditions de commande"
          }
          onClose={() => setPolicy(null)}
        >
          <p className="policy-copy">{catalog.settings[policy]}</p>
        </Modal>
      )}
      <CartDialogs />
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <Info size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Router />
      </StoreProvider>
    </ErrorBoundary>
  );
}
