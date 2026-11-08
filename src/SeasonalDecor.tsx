import { useEffect } from "react";
import { useStore } from "./store";
import { storefrontTheme } from "./seasonalTheme";
import "./seasonal-decor.css";

function RamadanEdge() {
  return (
    <>
      <svg className="seasonal-crescent" viewBox="0 0 40 40" focusable="false">
        <path
          d="M25 4A17 17 0 1 0 35 31 18 18 0 0 1 25 4Z"
          fill="currentColor"
        />
        <path
          d="m31 9 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5L25 12.5l3.5-.5Z"
          fill="currentColor"
        />
      </svg>
      <svg className="seasonal-lantern" viewBox="0 0 40 164" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M20 0v88m-4 7a4 4 0 1 1 8 0M12 101l8-6 8 6m-17 4h18l4 11-4 32H11l-4-32Zm-4 11h26m-22 26h18m-16-26 2 26m10-26-2 26m-8 12h10m-5 0v7" />
          <path
            d="m20 113 4 12-4 10-4-10Z"
            fill="currentColor"
            fillOpacity=".4"
          />
        </g>
      </svg>
      <svg
        className="seasonal-arabesque"
        viewBox="0 0 40 180"
        fill="none"
        focusable="false"
      >
        <path
          d="M20 0 37 25 20 50 3 25Zm0 50 17 25-17 25L3 75Zm0 50 17 25-17 25-17-25Zm0 50 17 25M20 150 3 175M20 9l10 16-10 16L10 25Zm0 50 10 16-10 16-10-16Zm0 50 10 16-10 16-10-16Z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      {[0, 1, 2].map((star) => (
        <svg
          className={"seasonal-star seasonal-star--" + star}
          viewBox="0 0 24 24"
          key={star}
          focusable="false"
        >
          <path
            d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </>
  );
}

function WinterEdge() {
  return (
    <>
      <svg
        className="seasonal-evergreen"
        viewBox="0 0 44 160"
        fill="none"
        focusable="false"
      >
        <path
          d="M22 156V6M22 25 9 15m13 10 13-10M22 44 5 30m17 14 17-14M22 65 3 49m19 16 19-16M22 88 1 70m21 18 21-18M22 111 1 93m21 18 21-18M22 134 1 116m21 18 21-18M11 36l-6 1m28-1 6 1M7 58l-6 2m36-2 6 2M6 82l-5 2m37-2 5 2M6 106l-5 2m37-2 5 2M6 129l-5 2m37-2 5 2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="15" cy="51" r="2" fill="currentColor" />
        <circle cx="28" cy="97" r="2" fill="currentColor" />
      </svg>
      {[0, 1, 2, 3].map((flake) => (
        <svg
          className={"seasonal-flake seasonal-flake--" + flake}
          key={flake}
          viewBox="0 0 32 32"
          focusable="false"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M12 6l4 4 4-4m-8 20 4-4 4 4M5.3 14l5.5-1.5L9.3 7M26.7 18l-5.5 1.5 1.5 5.5M9.3 25l1.5-5.5L5.3 18M22.7 7l-1.5 5.5 5.5 1.5" />
          </g>
        </svg>
      ))}
    </>
  );
}

export function SeasonalDecor({ active = true }: { active?: boolean }) {
  const { catalog } = useStore();
  const theme = active ? storefrontTheme(catalog?.settings || {}) : "classic";
  useEffect(() => {
    document.documentElement.dataset.storefrontTheme = theme;
    return () => {
      delete document.documentElement.dataset.storefrontTheme;
    };
  }, [theme]);
  if (theme === "classic") return null;
  const ramadan = theme.startsWith("ramadan");
  return (
    <div
      className={"seasonal-decor seasonal-decor--" + theme}
      aria-hidden="true"
    >
      <div className="seasonal-top-edge" />
      <div className="seasonal-edge seasonal-edge--left">
        {ramadan ? <RamadanEdge /> : <WinterEdge />}
      </div>
      <div className="seasonal-edge seasonal-edge--right">
        {ramadan ? <RamadanEdge /> : <WinterEdge />}
      </div>
    </div>
  );
}
