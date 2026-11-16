/** Approved navy/cyan interface palette. Reference and usage: docs/THEME.md. */
export const PALETTE = {
  bg: "#040810",
  panel: "#0a1623",
  panelRaised: "#0d2030",
  input: "#0b1c2a",
  line: "#1d3548",
  lineStrong: "#2b4b60",
  text: "#e3edf7",
  secondary: "#b6c8d8",
  muted: "#8ca4b7",
  subtle: "#69859c",
  accent: "#53e7de",
  accentHover: "#8afbf2",
  accentSoft: "#0b282f",
  warm: "#ffad66",
  danger: "#ff6172",
  glow: "#42b8ff",
  ocean: "#071b38",
  boundaries: "#35c7d4",
} as const;

export const THEME_CSS_VARIABLES = Object.fromEntries(
  Object.entries(PALETTE).map(([name, color]) => [
    `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    color,
  ]),
);

export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
