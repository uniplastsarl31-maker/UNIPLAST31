import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Catalog, Product, Order } from "./types";
import { assertQuantity, canBuy } from "./domain";
import * as api from "./api";

const CART_KEY = "uniplast.cart.v1";
function readCart(): { items: CartItem[]; key: string } {
  try {
    const v = JSON.parse(localStorage.getItem(CART_KEY) || "null");
    if (v && Array.isArray(v.items) && typeof v.key === "string")
      return {
        items: v.items
          .filter(
            (i: CartItem) =>
              typeof i.product_id === "string" &&
              Number.isInteger(i.cartons) &&
              i.cartons > 0 &&
              i.cartons <= 10000,
          )
          .slice(0, 100),
        key: v.key,
      };
  } catch {}
  return { items: [], key: crypto.randomUUID() };
}
type Toast = { message: string; error: boolean } | null;
interface Store {
  catalog: Catalog | null;
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
  now: number;
  cart: CartItem[];
  checkoutKey: string;
  addCart: (p: Product, n: number) => void;
  setQuantity: (id: string, n: number) => void;
  removeCart: (id: string) => void;
  emptyCart: () => void;
  repeatOrder: (order: Order) => void;
  admin: boolean;
  checkAdmin: () => Promise<void>;
  toast: Toast;
  notify: (s: string, error?: boolean) => void;
  quantityProduct: Product | null;
  openQuantity: (p: Product) => void;
  closeQuantity: () => void;
  added: Product | null;
  dismissAdded: () => void;
}
const Context = createContext<Store | null>(null);
export const navigate = (path: string) => {
  window.location.hash = path;
};
export function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");
  useEffect(() => {
    const fn = () => {
      setRoute(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(Date.now());
  const [basket, setBasket] = useState(readCart),
    [admin, setAdmin] = useState(false),
    [toast, setToast] = useState<Toast>(null);
  const [quantityProduct, setQuantityProduct] = useState<Product | null>(null),
    [added, setAdded] = useState<Product | null>(null),
    toastTimer = useRef<number | undefined>(undefined);
  const loadSequence = useRef(0);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6500);
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const c = await api.loadCatalog();
      if (sequence !== loadSequence.current) return;
      setCatalog(c);
      if (c.products.some((p) => p.price_hidden)) {
        setQuantityProduct(null);
        setAdded(null);
      }
      setError("");
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);
  const checkAdmin = useCallback(async () => {
    setAdmin(await api.isAdmin());
  }, []);
  useEffect(() => {
    void refresh();
    void checkAdmin();
    const stop = api.watchCatalog(() => {
      void refresh();
    });
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const { data: auth } = api.supabase?.auth.onAuthStateChange(
      (event, session) => {
        void window.setTimeout(() => {
          void checkAdmin();
          if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
            setCatalog(null);
            setLoading(true);
          }
          void refresh();
        }, 0);
        if (event === "PASSWORD_RECOVERY") navigate("/nouveau-mot-de-passe");
        if (
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          session &&
          new URLSearchParams(window.location.search).get("setup") ===
            "password"
        ) {
          const location = new URL(window.location.href);
          location.searchParams.delete("setup");
          window.history.replaceState(
            null,
            "",
            location.pathname + location.search + location.hash,
          );
          navigate("/nouveau-mot-de-passe");
        }
      },
    ) || { data: { subscription: null } };
    return () => {
      stop();
      window.clearInterval(t);
      auth.subscription?.unsubscribe();
    };
  }, [refresh, checkAdmin]);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(basket));
    } catch {
      notify(
        "Le navigateur empêche la sauvegarde du panier. Il reste disponible pour cette session.",
        true,
      );
    }
  }, [basket, notify]);
  useEffect(() => {
    if (catalog) {
      document.documentElement.style.setProperty(
        "--blue",
        catalog.settings.primary_color,
      );
      document.documentElement.style.setProperty(
        "--yellow",
        catalog.settings.accent_color,
      );
    }
  }, [catalog?.settings.primary_color, catalog?.settings.accent_color]);
  const update = (items: CartItem[]) =>
    setBasket({ items, key: crypto.randomUUID() });
  const addCart = (p: Product, n: number) => {
    if (!canBuy(p)) {
      notify(
        "La disponibilité et le tarif doivent être confirmés avant la commande.",
        true,
      );
      return;
    }
    try {
      const total =
        n + (basket.items.find((i) => i.product_id === p.id)?.cartons || 0);
      assertQuantity(total, p);
      const items = basket.items.filter((i) => i.product_id !== p.id);
      items.push({ product_id: p.id, cartons: total });
      update(items);
      setQuantityProduct(null);
      setAdded(p);
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const setQuantity = (id: string, n: number) => {
    try {
      assertQuantity(n);
      update(
        basket.items.map((i) =>
          i.product_id === id ? { ...i, cartons: n } : i,
        ),
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <Context.Provider
      value={{
        catalog,
        error,
        loading,
        refresh,
        now,
        cart: basket.items,
        checkoutKey: basket.key,
        addCart,
        setQuantity,
        removeCart: (id) =>
          update(basket.items.filter((i) => i.product_id !== id)),
        emptyCart: () => update([]),
        repeatOrder: (order) => {
          const items: CartItem[] = [];
          for (const line of order.items) {
            const p = catalog?.products.find((p) => p.id === line.product_id);
            if (
              p &&
              canBuy(p) &&
              catalog?.families.some((f) => f.id === p.family_id && f.visible)
            )
              items.push({
                product_id: p.id,
                cartons: Math.min(
                  line.cartons,
                  p.stock_cartons ?? line.cartons,
                ),
              });
          }
          if (!items.length) {
            notify(
              "Aucun produit de ce bon ne peut être commandé actuellement. Vérifiez l’accès aux tarifs et la disponibilité.",
              true,
            );
            return;
          }
          update(items);
          notify(
            "Sélection reprise dans le panier. Vérifiez les prix, le colisage et les quantités actuels. Les produits indisponibles sont exclus.",
          );
          navigate("/panier");
        },
        admin,
        checkAdmin,
        toast,
        notify,
        quantityProduct,
        openQuantity: setQuantityProduct,
        closeQuantity: () => setQuantityProduct(null),
        added,
        dismissAdded: () => setAdded(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw new Error("Store context missing");
  return s;
}
