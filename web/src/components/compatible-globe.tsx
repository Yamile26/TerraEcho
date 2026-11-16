"use client";
import { useEffect, useRef } from "react";
import { LEVEL_COLOR } from "@/lib/data";
import { PALETTE, withAlpha } from "@/lib/theme";
import type { CellVoice, GeoCollection } from "@/lib/types";
import type { GlobeLayers } from "./globe";

/** Software spherical projection for devices without WebGL. The Three.js scene remains the primary renderer. */
export function CompatibleGlobe({
  cells,
  geo,
  layers,
  rotating,
  zoom,
  resetKey,
  onInspect,
}: {
  cells: CellVoice[];
  geo: GeoCollection | null;
  layers: GlobeLayers;
  rotating: boolean;
  zoom: number;
  resetKey: number;
  onInspect: (c: CellVoice | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    latest = useRef({ cells, geo, layers, rotating, zoom, onInspect }),
    orientation = useRef({ lon: -75, lat: -7 });
  latest.current = { cells, geo, layers, rotating, zoom, onInspect };
  useEffect(() => {
    orientation.current = { lon: -75, lat: -7 };
  }, [resetKey]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sphere = document.createElement("canvas"),
      resolution = 300;
    sphere.width = resolution;
    sphere.height = resolution;
    const sc = sphere.getContext("2d");
    if (!sc) return;
    let texture: ImageData | null = null,
      alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      const temp = document.createElement("canvas");
      temp.width = image.width;
      temp.height = image.height;
      const tc = temp.getContext("2d", { willReadFrequently: true });
      if (tc) {
        tc.drawImage(image, 0, 0);
        texture = tc.getImageData(0, 0, image.width, image.height);
      }
    };
    image.src = "/textures/earth.jpg";
    const pixels = sc.createImageData(resolution, resolution),
      normals: { i: number; x: number; y: number; z: number; light: number }[] =
        [];
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++) {
        const nx = (x + 0.5 - resolution / 2) / (resolution / 2),
          ny = -(y + 0.5 - resolution / 2) / (resolution / 2),
          d = nx * nx + ny * ny;
        if (d < 1) {
          const nz = Math.sqrt(1 - d);
          normals.push({
            i: (y * resolution + x) * 4,
            x: nx,
            y: ny,
            z: nz,
            light: 0.2 + 0.69 * Math.max(0, -nx * 0.45 + ny * 0.45 + nz * 0.77),
          });
        }
      }
    let w = 0,
      h = 0,
      frame = 0,
      last = 0,
      elapsed = 0,
      down: { x: number; y: number; lon: number; lat: number } | null = null,
      dragged = false;
    let projected: { x: number; y: number; cell: CellVoice }[] = [];
    const resize = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * Math.min(devicePixelRatio, 1.5));
      canvas.height = Math.round(h * Math.min(devicePixelRatio, 1.5));
    });
    resize.observe(canvas);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || now - last < 55 || !w || !h) return;
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const state = latest.current;
      if (state.rotating && !down) {
        orientation.current.lon += delta * 0.65;
        elapsed += delta;
      }
      const longitude = (orientation.current.lon * Math.PI) / 180,
        latitude = (orientation.current.lat * Math.PI) / 180;
      const f = [
          Math.cos(latitude) * Math.cos(longitude),
          Math.sin(latitude),
          -Math.cos(latitude) * Math.sin(longitude),
        ],
        r = [-Math.sin(longitude), 0, -Math.cos(longitude)],
        u = [
          -Math.sin(latitude) * Math.cos(longitude),
          Math.cos(latitude),
          Math.sin(latitude) * Math.sin(longitude),
        ];
      const radius =
          Math.min(h * 0.38, w * 0.4) * Math.max(0.5, 1 + state.zoom * 0.095),
        cx = w * 0.53,
        cy = h * 0.47;
      const ratio = canvas.width / w;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Real equirectangular Earth texture, inverse-projected onto the visible hemisphere.
      if (texture) {
        for (const n of normals) {
          const wx = n.x * r[0] + n.y * u[0] + n.z * f[0],
            wy = n.x * r[1] + n.y * u[1] + n.z * f[1],
            wz = n.x * r[2] + n.y * u[2] + n.z * f[2];
          const lon = Math.atan2(-wz, wx),
            lat = Math.asin(Math.max(-1, Math.min(1, wy)));
          const tx = Math.min(
              texture.width - 1,
              Math.floor(((lon + Math.PI) / (2 * Math.PI)) * texture.width),
            ),
            ty = Math.min(
              texture.height - 1,
              Math.floor(((Math.PI / 2 - lat) / Math.PI) * texture.height),
            ),
            j = (ty * texture.width + tx) * 4;
          pixels.data[n.i] = Math.min(
            255,
            texture.data[j] * n.light * 0.78 + 3,
          );
          pixels.data[n.i + 1] = Math.min(
            255,
            texture.data[j + 1] * n.light * 0.94 + 6,
          );
          pixels.data[n.i + 2] = Math.min(
            255,
            texture.data[j + 2] * n.light * 1.15 + 14,
          );
          pixels.data[n.i + 3] = 255;
        }
        sc.putImageData(pixels, 0, 0);
        ctx.save();
        ctx.shadowColor = withAlpha(PALETTE.glow, 0.7);
        ctx.shadowBlur = 30;
        ctx.drawImage(sphere, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(
          cx - radius * 0.3,
          cy - radius * 0.4,
          0,
          cx,
          cy,
          radius,
        );
        g.addColorStop(0, PALETTE.lineStrong);
        g.addColorStop(1, PALETTE.ocean);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = withAlpha(PALETTE.glow, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2);
      ctx.stroke();
      const project = (lat: number, lon: number) => {
        const a = (lat * Math.PI) / 180,
          b = (lon * Math.PI) / 180,
          p = [
            Math.cos(a) * Math.cos(b),
            Math.sin(a),
            -Math.cos(a) * Math.sin(b),
          ];
        return {
          x: cx + (p[0] * r[0] + p[1] * r[1] + p[2] * r[2]) * radius,
          y: cy - (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) * radius,
          visible: p[0] * f[0] + p[1] * f[1] + p[2] * f[2] > 0.04,
        };
      };
      if (state.geo) {
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = withAlpha(PALETTE.boundaries, 0.8);
        for (const feature of state.geo.features) {
          const polys =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates as number[][][]]
              : (feature.geometry.coordinates as number[][][][]);
          for (const poly of polys)
            for (const ring of poly) {
              ctx.beginPath();
              let started = false;
              for (const [lon, lat] of ring) {
                const p = project(lat, lon);
                if (p.visible) {
                  if (started) ctx.lineTo(p.x, p.y);
                  else ctx.moveTo(p.x, p.y);
                  started = true;
                } else started = false;
              }
              ctx.stroke();
            }
        }
      }
      projected = [];
      if (state.layers.fires)
        for (const cell of state.cells) {
          const p = project(cell.lat, cell.lon);
          if (!p.visible) continue;
          projected.push({ x: p.x, y: p.y, cell });
          ctx.fillStyle = LEVEL_COLOR[cell.level];
          ctx.shadowBlur = cell.alert ? 7 : 0;
          ctx.shadowColor = LEVEL_COLOR[cell.level];
          ctx.beginPath();
          ctx.arc(
            p.x,
            p.y,
            0.8 + Math.min(1.5, Math.log1p(cell.count) * 0.18),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      ctx.shadowBlur = 0;
      if (state.layers.waves) {
        const p = project(-9, -74);
        if (p.visible)
          for (let i = 0; i < 3; i++) {
            const t = (elapsed * 0.25 + i / 3) % 1;
            ctx.strokeStyle = withAlpha(PALETTE.accent, (1 - t) * 0.5);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 5 + t * 34, 2 + t * 14, -0.3, 0, Math.PI * 2);
            ctx.stroke();
          }
      }
      if (state.layers.orbits) {
        for (let j = 0; j < 2; j++) {
          const rotation = -0.5 + j * 1.1,
            rx = radius * 1.25,
            ry = radius * (0.4 + j * 0.15);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotation);
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = withAlpha(
            j ? PALETTE.glow : PALETTE.boundaries,
            0.28,
          );
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          const t = elapsed * (0.13 + j * 0.03) + j * 2.4;
          ctx.translate(Math.cos(t) * rx, Math.sin(t) * ry);
          ctx.rotate(-rotation);
          ctx.fillStyle = PALETTE.lineStrong;
          ctx.fillRect(-16, -4, 11, 8);
          ctx.fillRect(5, -4, 11, 8);
          ctx.strokeStyle = PALETTE.muted;
          ctx.strokeRect(-16, -4, 11, 8);
          ctx.strokeRect(5, -4, 11, 8);
          ctx.fillStyle = PALETTE.text;
          ctx.fillRect(-3, -5, 6, 10);
          ctx.fillStyle = PALETTE.accent;
          ctx.beginPath();
          ctx.arc(0, -8, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };
    frame = requestAnimationFrame(draw);
    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const pointerdown = (e: PointerEvent) => {
      const p = pos(e);
      down = { ...p, ...orientation.current };
      dragged = false;
      canvas.setPointerCapture(e.pointerId);
    };
    const pointermove = (e: PointerEvent) => {
      if (!down) return;
      const p = pos(e);
      if (Math.hypot(p.x - down.x, p.y - down.y) > 4) dragged = true;
      orientation.current.lon = down.lon - (p.x - down.x) * 0.18;
      orientation.current.lat = Math.max(
        -75,
        Math.min(75, down.lat + (p.y - down.y) * 0.18),
      );
    };
    const pointerup = (e: PointerEvent) => {
      if (!dragged) {
        const p = pos(e);
        const nearest = [...projected].sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        )[0];
        if (nearest && Math.hypot(nearest.x - p.x, nearest.y - p.y) < 12)
          latest.current.onInspect(nearest.cell);
      }
      down = null;
    };
    const cancel = () => {
      down = null;
    };
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("pointerup", pointerup);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      image.onload = null;
      canvas.removeEventListener("pointerdown", pointerdown);
      canvas.removeEventListener("pointermove", pointermove);
      canvas.removeEventListener("pointerup", pointerup);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }, []);
  return (
    <>
      <canvas ref={ref} className="compatible-canvas" />
      <span className="compatible-label">
        PROYECCIÓN ESFÉRICA · MODO COMPATIBLE
      </span>
    </>
  );
}
