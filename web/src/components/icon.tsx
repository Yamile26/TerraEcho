import type { CSSProperties } from "react";
export type IconName =
  | "globe"
  | "wave"
  | "chart"
  | "layers"
  | "info"
  | "volume"
  | "mute"
  | "play"
  | "pause"
  | "chevron"
  | "arrow"
  | "cross"
  | "download"
  | "reset"
  | "plus"
  | "minus"
  | "satellite"
  | "headphones"
  | "external"
  | "check"
  | "eye"
  | "keyboard"
  | "fire"
  | "menu";
const paths: Record<IconName, React.ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6.5h14M5 17.5h14" />
    </>
  ),
  wave: <path d="M2 12h2l2-6 3 13 3-16 3 15 3-10 2 4h2" />,
  chart: (
    <>
      <path d="M4 3v17h17M7 14l4-5 4 3 6-8" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.2" />
    </>
  ),
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  mute: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8V4Z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" strokeWidth="3" />
    </>
  ),
  chevron: <path d="m8 4 8 8-8 8" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  cross: <path d="m6 6 12 12M6 18 18 6" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 2 8M3 3v7h7" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  minus: <path d="M4 12h16" />,
  satellite: (
    <>
      <path d="m9 9 6 6m-5-9 4-4 8 8-4 4M6 10l-4 4 8 8 4-4m-4-9 5-5 5 5-5 5Z" />
      <path d="M7 4a6 6 0 0 0-3 3" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v8h5v-8H4Zm16 0h2v8h-5v-8h3Z" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 12h.1M10 12h.1M14 12h.1M18 12h.1M6 16h12" />
    </>
  ),
  fire: (
    <path d="M13 2c2 6-3 7-1 10 2-1 3-3 3-5 7 7 5 15-3 15S1 14 7 8c-1 5 2 6 3 6-2-6 1-8 3-12Z" />
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
