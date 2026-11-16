/** Interface colors sampled from the user's supplied TerraEcho design reference. */
export const PALETTE = {
  bg: "#0a1215",
  panel: "#121e21",
  panelRaised: "#192a2a",
  input: "#1b2a29",
  line: "#2b3c3a",
  lineStrong: "#405448",
  text: "#ecf0e9",
  secondary: "#b8c4bf",
  muted: "#9cac9f",
  subtle: "#829587",
  accent: "#c5eca3",
  accentHover: "#daf9be",
  accentSoft: "#263a2b",
  warm: "#e9cb77",
  danger: "#ff835b",
  glow: "#4c8f97",
  ocean: "#071a26",
  boundaries: "#8aa38c",
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
