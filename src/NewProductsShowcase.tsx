import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "./types";
import "./new-products-showcase.css";

export function NewProductsShowcase({
  products,
  renderProduct,
  title = "Les nouveautés",
  href = "#/catalogue?filtre=nouveautes",
}: {
  products: readonly Product[];
  renderProduct: (product: Product) => ReactNode;
  title?: string;
  href?: string;
}) {
  const headingId = useId();
  const rail = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const updateNavigation = () => {
    const element = rail.current;
    if (!element) return;
    setCanPrevious(element.scrollLeft > 2);
    setCanNext(
      element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    );
  };
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    updateNavigation();
    const observer = new ResizeObserver(updateNavigation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [products.length]);
  const scroll = (direction: -1 | 1) => {
    const element = rail.current;
    if (!element) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollBy({
      left: direction * element.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };
  if (!products.length) return null;
  return (
    <section className="new-products-showcase" aria-labelledby={headingId}>
      <div className="new-products-showcase__heading">
        <h2 id={headingId}>{title}</h2>
        <div className="new-products-showcase__actions">
          <a className="new-products-showcase__all" href={href}>
            Tout voir <ArrowRight size={17} aria-hidden="true" />
          </a>
          <div className="new-products-showcase__arrows">
            <button
              type="button"
              aria-label="Nouveautés précédentes"
              aria-controls={headingId + "-rail"}
              disabled={!canPrevious}
              onClick={() => scroll(-1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Nouveautés suivantes"
              aria-controls={headingId + "-rail"}
              disabled={!canNext}
              onClick={() => scroll(1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div
        id={headingId + "-rail"}
        className="new-products-showcase__rail"
        ref={rail}
        onScroll={updateNavigation}
      >
        {products.map((product) => (
          <Fragment key={product.id}>{renderProduct(product)}</Fragment>
        ))}
      </div>
    </section>
  );
}
