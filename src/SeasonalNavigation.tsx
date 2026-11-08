import { useRoute, useStore } from "./store";
import { storefrontTheme } from "./seasonalTheme";

function FestivalArtwork({ ramadan }: { ramadan: boolean }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" focusable="false" aria-hidden="true">
      {ramadan ? (
        <>
          <path
            d="M24 145V82C24 47 61 32 80 12c19 20 56 35 56 70v63Z"
            fill="currentColor"
            fillOpacity=".09"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M32 144V83c0-28 30-43 48-60 18 17 48 32 48 60v61M17 148h126M80 12V4"
            stroke="currentColor"
            strokeOpacity=".5"
          />
          <path
            d="M89 47a25 25 0 1 0 23 35 27 27 0 0 1-23-35Z"
            fill="currentColor"
          />
          <path
            d="m110 47 2.6 6 6.4.5-4.8 4.4 1.4 6.4-5.6-3.3-5.6 3.3 1.4-6.4-4.8-4.4 6.4-.5Z"
            fill="currentColor"
          />
          <g stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
            <path d="M48 30v59m-5 8 5-7 5 7m-14 4h18l5 10-5 23H39l-5-23Zm-5 10h28m-22 18h16m-15-18 3 18m8-18-3 18m-5 6v8M116 83v19m-5 6 5-5 5 5m-12 3h14l4 8-4 17h-14l-4-17Zm-4 8h22m-16 13h10m-6 4v8" />
            <path
              d="m48 111 4 9-4 6-4-6Zm68 7 3 7-3 5-3-5Z"
              fill="currentColor"
              fillOpacity=".3"
            />
          </g>
          <path
            d="m22 42 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm110-17 1.5 4.5L138 31l-4.5 1.5L132 37l-1.5-4.5L126 31l4.5-1.5Z"
            fill="currentColor"
          />
          <circle cx="65" cy="112" r="1.8" fill="currentColor" />
          <circle cx="98" cy="121" r="1.8" fill="currentColor" />
        </>
      ) : (
        <>
          <circle
            cx="80"
            cy="80"
            r="62"
            fill="currentColor"
            fillOpacity=".07"
            stroke="currentColor"
            strokeOpacity=".5"
          />
          <circle
            cx="80"
            cy="80"
            r="54"
            stroke="currentColor"
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
          <g
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M80 40v80M45 60l70 40M45 100l70-40m-43-12 8 9 8-9m-16 64 8-9 8 9M48 70l13-3-3-13m54 36-13 3 3 13M58 106l3-13-13-3m54-36-3 13 13 3" />
            <path d="M29 135q-7-30 3-61m-2 27-10-8m9 20-12-7m12 20-10-4m13-26 9-8m-11 21 11-8m-10 20 11-6M131 135q7-30-3-61m2 27 10-8m-9 20 12-7m-12 20 10-4m-13-26-9-8m11 21-11-8m10 20-11-6" />
          </g>
          <path
            d="m130 24 2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5ZM29 27l1.8 5.2L36 34l-5.2 1.8L29 41l-1.8-5.2L22 34l5.2-1.8Z"
            fill="currentColor"
          />
          <circle cx="52" cy="24" r="2" fill="currentColor" />
          <circle cx="112" cy="140" r="2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function SeasonalNavigation({
  placement,
}: {
  placement: "header" | "menu";
}) {
  const { catalog } = useStore();
  const route = useRoute();
  const theme = route.startsWith("/admin")
    ? "classic"
    : storefrontTheme(catalog?.settings || {});
  if (theme === "classic") return null;
  const ramadan = theme.startsWith("ramadan");
  if (placement === "header") {
    return (
      <div className="seasonal-header-art" aria-hidden="true">
        <FestivalArtwork ramadan={ramadan} />
      </div>
    );
  }
  return (
    <div className="seasonal-nav-banner container" aria-hidden="true">
      <FestivalArtwork ramadan={ramadan} />
      <div>
        <small>
          UNIPLAST · {ramadan ? "COLLECTION RAMADAN" : "ESPRIT DE FÊTE"}
        </small>
        <strong>{ramadan ? "Ramadan Moubarak" : "Meilleurs vœux"}</strong>
        <p>
          {ramadan
            ? "Des moments de partage, une maison qui vous ressemble."
            : "Une nouvelle année, de belles idées pour votre maison."}
        </p>
      </div>
      <span className="seasonal-banner-sparkle">{ramadan ? "✦" : "❄"}</span>
    </div>
  );
}
