import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Layers } from "lucide-react";
import type { Hero } from "./types";
import { slideComposition } from "./slider";

function Artwork({
  slide: h,
  onReady,
  className = "",
}: {
  slide: Hero;
  onReady?: () => void;
  className?: string;
}) {
  const c = slideComposition(h),
    poster = h.layout === "poster";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [h.image]);
  return (
    <div
      className={`slider-art-layer photo-${c.photo_mode} ${poster ? "art-poster" : ""} ${className}`}
      style={
        {
          "--frame-size": c.frame_size / 100,
          "--frame-percent": c.frame_size + "%",
          "--frame-width": c.frame_width + "px",
          "--frame-color": c.frame_color,
          "--photo-background": c.background_color,
          "--photo-blend": poster ? "normal" : c.blend,
        } as CSSProperties
      }
    >
      <div className="slider-artboard">
        <div className="slider-photo-window">
          {h.image && !failed ? (
            <img
              src={h.image}
              alt={h.title.replace(/\n/g, " ")}
              decoding="async"
              onLoad={onReady}
              onError={() => {
                setFailed(true);
                onReady?.();
              }}
              style={{
                objectFit:
                  h.fit || (c.photo_mode === "product" ? "contain" : "cover"),
                objectPosition: `${50 + (h.x || 0)}% ${50 + (h.y || 0)}%`,
                transform: `scale(${h.scale || 1})`,
              }}
            />
          ) : (
            <div className="slider-family-placeholder">
              <Layers size={80} strokeWidth={0.8} />
              <span>{failed ? "Image indisponible" : h.title}</span>
            </div>
          )}
        </div>
        {!poster && c.frame_visible && (
          <div className="slider-photo-frame" aria-hidden="true" />
        )}
      </div>
      {!poster && c.signature_visible && (
        <span className="slider-seal">
          HOME
          <br />
          <strong>DESIGN.</strong>
        </span>
      )}
    </div>
  );
}
export function SliderVisual({
  slide,
  animate = true,
  reduced = false,
}: {
  slide: Hero;
  animate?: boolean;
  reduced?: boolean;
}) {
  const lastReady = useRef(slide),
    [outgoing, setOutgoing] = useState<Hero | null>(null),
    [loaded, setLoaded] = useState("");
  const c = slideComposition(slide),
    key = slide.id + "|" + slide.image;
  const ready = !slide.image || loaded === key,
    motion = animate && !reduced && c.transition !== "none";
  useLayoutEffect(() => {
    if (
      motion &&
      (lastReady.current.id !== slide.id ||
        lastReady.current.image !== slide.image)
    )
      setOutgoing(lastReady.current);
    else if (!motion) setOutgoing(null);
  }, [key, motion]);
  useEffect(() => {
    if (!ready) return;
    lastReady.current = slide;
    if (!outgoing) return;
    const timer = window.setTimeout(
      () => setOutgoing(null),
      motion ? c.duration_ms : 0,
    );
    return () => window.clearTimeout(timer);
  }, [ready, key, outgoing, motion, c.duration_ms]);
  return (
    <div
      className={`slider-visual composed-visual motion-${motion ? c.transition : "none"}`}
      style={
        {
          "--art-duration": c.duration_ms + "ms",
          backgroundColor: c.background_color,
        } as CSSProperties
      }
      aria-busy={!ready}
    >
      {outgoing && motion && (
        <div className="slider-outgoing" aria-hidden="true">
          <Artwork slide={outgoing} />
        </div>
      )}
      <Artwork
        key={key}
        slide={slide}
        className={"slider-current " + (ready ? "is-ready" : "is-loading")}
        onReady={() => setLoaded(key)}
      />
    </div>
  );
}
