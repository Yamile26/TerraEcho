import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { THEME_CSS_VARIABLES } from "@/lib/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "TerraEcho · Escucha lo que la Tierra nos dice",
  description:
    "Explora y escucha las anomalías de focos de calor en Perú con NASA FIRMS y visualizaciones del Earth Information Center. Team AstraCom · NASA Space Apps 2026.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={THEME_CSS_VARIABLES as CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
