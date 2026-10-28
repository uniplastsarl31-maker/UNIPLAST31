import { useEffect, useRef, type ReactNode } from "react";
import { Box, Minus, Plus, X } from "lucide-react";
import type { Product, ProductImage } from "./types";
import { activeDiscount, canBuy, discountPercent } from "./domain";

const modalStack: symbol[] = [];
let savedBody: { overflow: string; paddingRight: string; y: number } | null =
  null;

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closer = useRef(onClose);
  closer.current = onClose;
  useEffect(() => {
    const token = Symbol();
    if (!modalStack.length) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      savedBody = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
        y: window.scrollY,
      };
      document.body.style.overflow = "hidden";
      if (gap > 0) document.body.style.paddingRight = gap + "px";
    }
    modalStack.push(token);
    const prev = document.activeElement as HTMLElement | null;
    const f = () =>
      ref.current
        ?.querySelector<HTMLElement>("button,input,select,textarea,a[href]")
        ?.focus({ preventScroll: true });
    f();
    const key = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== token) return;
      if (e.key === "Escape") closer.current();
      if (e.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select,textarea,a[href],[tabindex="0"]',
          ) || [],
        ).filter((x) => x.offsetParent !== null);
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      const index = modalStack.indexOf(token);
      if (index !== -1) modalStack.splice(index, 1);
      if (!modalStack.length && savedBody) {
        document.body.style.overflow = savedBody.overflow;
        document.body.style.paddingRight = savedBody.paddingRight;
        window.scrollTo({ top: savedBody.y, behavior: "instant" });
        savedBody = null;
      }
      document.removeEventListener("keydown", key);
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ProductPhoto({
  image,
  name,
  className = "",
  eager = false,
}: {
  image?: ProductImage;
  name: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`product-photo ${className}`}>
      {image ? (
        <img
          src={image.url}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={(e) => {
            e.currentTarget.style.removeProperty("display");
            e.currentTarget.parentElement?.classList.remove("image-failed");
          }}
          style={{
            transform: `translate(${Math.max(-50, Math.min(50, image.x))}%,${Math.max(-50, Math.min(50, image.y))}%) scale(${Math.max(0.5, Math.min(3, image.scale))})`,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("image-failed");
          }}
        />
      ) : (
        <div className="photo-placeholder">
          <Box strokeWidth={1} size={43} />
          <span>Photo à ajouter</span>
        </div>
      )}
    </div>
  );
}
export function Badges({ product: p, now }: { product: Product; now: number }) {
  const discount = activeDiscount(p, now);
  return (
    <div className="badges">
      {!p.availability_confirmed ? (
        <span className="badge unknown">À confirmer</span>
      ) : !p.available || p.stock_cartons === 0 ? (
        <span className="badge unavailable">Indisponible pour le moment</span>
      ) : p.upcoming ? (
        <span className="badge upcoming">Bientôt disponible</span>
      ) : (
        <span className="badge available">Disponible</span>
      )}
      {p.is_new && <span className="badge new">Nouveau</span>}
      {discount && (
        <span className="badge sale">−{discountPercent(p, now)} %</span>
      )}
    </div>
  );
}
export function Quantity({
  value,
  onChange,
  max = 10000,
  label = "Nombre de cartons",
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        aria-label="Diminuer la quantité"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
      >
        <Minus size={15} />
      </button>
      <input
        aria-label={label}
        type="number"
        min="1"
        max={max}
        step="1"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
        }}
      />
      <button
        type="button"
        aria-label="Augmenter la quantité"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Box size={32} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Spinner() {
  return <span className="spinner" aria-label="Chargement" />;
}
export function buyLabel(p: Product) {
  return p.upcoming
    ? "Précommander"
    : canBuy(p)
      ? "Ajouter au panier"
      : p.price_on_request
        ? "Prix sur demande"
        : "Disponibilité à confirmer";
}
