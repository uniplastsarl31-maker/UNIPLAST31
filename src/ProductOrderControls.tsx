import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, LockKeyhole } from "lucide-react";
import type { Product } from "./types";
import { hasManualPosition } from "./productOrdering";
import { Modal } from "./ui";

export function ProductOrderControls({
  product,
  position,
  total,
  disabled,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  product: Product;
  position: number;
  total: number;
  disabled: boolean;
  onChange: (position: number | null) => Promise<boolean>;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(position);
  const fixed = hasManualPosition(product);
  return (
    <div className="product-order-controls">
      <div className="product-order-buttons">
        <button
          type="button"
          className="icon-btn product-drag-handle"
          draggable={!disabled}
          disabled={disabled}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          aria-label={"Glisser pour déplacer " + product.name}
          title="Glissez vers un produit de la même collection"
        >
          <GripVertical size={17} />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={disabled || position <= 1}
          aria-label={"Monter " + product.name}
          onClick={() => void onChange(position - 1)}
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          className="product-position-button"
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
        <button
          type="button"
          className="icon-btn"
          disabled={disabled || position >= total}
          aria-label={"Descendre " + product.name}
          onClick={() => void onChange(position + 1)}
        >
          <ArrowDown size={15} />
        </button>
      </div>
      <label className={"product-position-lock " + (fixed ? "is-fixed" : "")}>
        <input
          type="checkbox"
          checked={fixed}
          disabled={disabled}
          aria-label={"Exclure du tri automatique : " + product.name}
          onChange={(event) =>
            void onChange(event.target.checked ? position : null)
          }
        />
        {fixed && <LockKeyhole size={11} />}{" "}
        {fixed ? "Position fixée" : "Automatique"}
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
