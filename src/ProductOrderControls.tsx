import { useState } from "react";
import type { Product } from "./types";
import { hasManualPosition } from "./productOrdering";
import { Modal } from "./ui";

export function ProductOrderControls({
  product,
  position,
  total,
  disabled,
  onChange,
}: {
  product: Product;
  position: number;
  total: number;
  disabled: boolean;
  onChange: (position: number | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(position);
  const fixed = hasManualPosition(product);
  return (
    <div className="product-order-controls">
      <div className="product-order-buttons">
        <button
          type="button"
          className={"product-position-button" + (fixed ? " is-fixed" : "")}
          disabled={disabled}
          aria-label={"Choisir la position de " + product.name}
          onClick={() => {
            setDraft(position);
            setOpen(true);
          }}
          title="Choisir une position dans cette collection"
        >
          {position}
        </button>
      </div>
      <label
        className={"product-position-lock " + (fixed ? "is-fixed" : "")}
        title="Coché : tri automatique. Décoché : position fixée."
      >
        <input
          type="checkbox"
          checked={!fixed}
          disabled={disabled}
          aria-label={"Tri automatique : " + product.name}
          onChange={(event) =>
            void onChange(event.target.checked ? null : position)
          }
        />{" "}
        Auto
      </label>
      {open && (
        <Modal
          title="Déplacer le produit"
          onClose={() => {
            if (!disabled) setOpen(false);
          }}
        >
          <p>
            <strong>{product.name}</strong>
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onChange(draft)) setOpen(false);
            }}
          >
            <label className="product-position-field">
              Position dans sa collection
              <input
                autoFocus
                required
                type="number"
                min={1}
                max={total}
                step={1}
                value={draft}
                onChange={(event) => setDraft(Number(event.target.value))}
              />
            </label>
            <p className="muted-copy">
              De 1 à {total}. Le déplacement fixe sa position et l’exclut du tri
              automatique par référence et par série.
            </p>
            <div className="dialog-action-stack">
              <button
                className="btn btn-primary"
                disabled={disabled}
                type="submit"
              >
                Déplacer et fixer
              </button>
              <button
                className="btn btn-outline"
                disabled={disabled}
                type="button"
                onClick={() => setOpen(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
