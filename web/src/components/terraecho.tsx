"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sonifier } from "@/lib/audio";
import {
  dateLabel,
  LEVEL_COLOR,
  LEVEL_LABEL,
  number,
  regionCells,
  selectedMetrics,
  toCsv,
  weekRange,
} from "@/lib/data";
import { useDataset, useGeography } from "@/hooks/use-dataset";
import type { CellVoice, FireWeek } from "@/lib/types";
import type { GlobeLayers } from "./globe";
import { PeruMap } from "./globe";
import { Icon, type IconName } from "./icon";
import { Timeline } from "./timeline";
import { Temporal } from "./temporal";
import { EicStudio } from "./eic-studio";
import { InfoDialog, type DialogKind } from "./dialog";
const Globe = dynamic(() => import("./globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="globe-loading">
      <span className="orbit-loader" />
      Preparando la órbita…
    </div>
  ),
});
type View = "explorer" | "history" | "eic";
const NAV: { id: View; label: string; icon: IconName; index: string }[] = [
  { id: "explorer", label: "Explorar la Tierra", icon: "globe", index: "01" },
  { id: "history", label: "Observatorio", icon: "chart", index: "02" },
  { id: "eic", label: "Estudio EIC", icon: "wave", index: "03" },
];

function MiniChart({ weeks, index }: { weeks: FireWeek[]; index: number }) {
  const max = Math.max(1, ...weeks.map((w) => w.country.count));
  const pts = weeks
    .map(
      (w, i) =>
        `${(i / (weeks.length - 1)) * 260},${49 - (w.country.count / max) * 43}`,
    )
    .join(" ");
  return (
    <svg className="mini-chart" viewBox="0 0 260 56" aria-hidden="true">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#bdea9d" stopOpacity=".18" />
          <stop offset="1" stopColor="#bdea9d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,55 ${pts} 260,55`} fill="url(#sparkfill)" />
      <polyline points={pts} fill="none" stroke="#8da68c" strokeWidth="1.4" />
      <line
        x1={(index / (weeks.length - 1)) * 260}
        x2={(index / (weeks.length - 1)) * 260}
        y1="0"
        y2="56"
        stroke="#d2f4a8"
        strokeDasharray="2 3"
      />
      <circle
        cx={(index / (weeks.length - 1)) * 260}
        cy={49 - (weeks[index].country.count / max) * 43}
        r="3.2"
        fill="#d2f4a8"
      />
    </svg>
  );
}
export function TerraEcho() {
  const [view, setView] = useState<View>("explorer"),
    [year, setYear] = useState(2026),
    [index, setIndex] = useState(39),
    [region, setRegion] = useState("Perú");
  const { score, error, loading, retry } = useDataset(year);
  const geo = useGeography();
  const [sound, setSound] = useState(false),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.35),
    [audioError, setAudioError] = useState("");
  const [rotating, setRotating] = useState(true),
    [map2d, setMap2d] = useState(false),
    [resetKey, setResetKey] = useState(0),
    [zoom, setZoom] = useState(0);
  const [layers, setLayers] = useState<GlobeLayers>({
    fires: true,
    orbits: true,
    waves: true,
  });
  const [showLayers, setShowLayers] = useState(false);
  const [inspected, setInspected] = useState<CellVoice | null>(null),
    [dialog, setDialog] = useState<DialogKind | null>(null),
    [speaking, setSpeaking] = useState(false);
  const engine = useRef<Sonifier | null>(null),
    datasetIndex = Math.min(index, (score?.weeks.length ?? 1) - 1),
    week = score?.weeks[datasetIndex];
  const metrics = week ? selectedMetrics(week, region) : null;
  const cells = useMemo(
    () => (week ? regionCells(week, region, geo) : []),
    [week, region, geo],
  );
  const sortedRegions = useMemo(
    () => (week ? [...week.regions].sort((a, b) => b.count - a.count) : []),
    [week],
  );
  const closeDialog = useCallback(() => setDialog(null), []);
  useEffect(() => {
    engine.current = new Sonifier();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setRotating(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => {
      engine.current?.dispose();
      window.speechSynthesis?.cancel();
      media.removeEventListener("change", sync);
    };
  }, []);
  useEffect(() => {
    engine.current?.volume(volume);
  }, [volume]);
  useEffect(() => {
    engine.current?.stop();
    if (!sound || !week || view === "eic") return;
    const synth = () => engine.current?.fire(week, cells, region === "Perú");
    synth();
    const timer = setInterval(synth, 1400);
    return () => {
      clearInterval(timer);
      engine.current?.stop();
    };
  }, [sound, week, cells, region, view]);
  useEffect(() => {
    if (!playing || !score || view === "eic") return;
    const id = setTimeout(() => {
      if (datasetIndex >= score.weeks.length - 1) {
        setPlaying(false);
        setSound(false);
      } else setIndex((n) => n + 1);
    }, 2000);
    return () => clearTimeout(id);
  }, [playing, score, datasetIndex, view]);
  useEffect(() => {
    setInspected(null);
  }, [datasetIndex, year, region]);
  useEffect(() => {
    if (!sound) setPlaying(false);
  }, [sound]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        engine.current?.stop();
        setPlaying(false);
        setSound(false);
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  function navigate(next: View) {
    setView(next);
    setPlaying(false);
    setSound(false);
    setInspected(null);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }
  function changeYear(y: number) {
    if (y === year) return;
    setSound(false);
    setPlaying(false);
    setYear(y);
    setIndex(39);
  }
  async function enableSound() {
    try {
      await engine.current?.enable();
      engine.current?.volume(volume);
      setAudioError("");
      setSound(true);
      return true;
    } catch {
      setAudioError(
        "No se pudo iniciar el audio. Prueba de nuevo desde el botón de escucha.",
      );
      return false;
    }
  }
  async function toggleSound() {
    if (sound) {
      setSound(false);
      setPlaying(false);
    } else await enableSound();
  }
  async function toggleJourney() {
    if (playing) {
      setPlaying(false);
      setSound(false);
    } else {
      if (await enableSound()) setPlaying(true);
    }
  }
  function exportCsv() {
    if (!score) return;
    const blob = new Blob(["\uFEFF" + toCsv(score.weeks, region)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terraecho-${year}-${region.toLowerCase().replaceAll(" ", "-")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function readSelection() {
    if (!week) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      setAudioError(
        "La voz del navegador no está disponible. La descripción textual y la tabla contienen la misma información.",
      );
      return;
    }
    setSound(false);
    const message = `${region === "Perú" ? "Área de estudio alrededor de Perú" : region}. Semana del ${dateLabel(week.start_date, true)} de ${year}. ${week.data_gap ? "Datos insuficientes. No se interpreta como calma." : `${number(metrics?.count ?? 0)} focos de calor detectados. ${LEVEL_LABEL[metrics?.level ?? "no_data"]}. Anomalía ${metrics?.z?.toFixed(2)}. Los focos no equivalen a incendios individuales.`}`;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "es-PE";
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }
  const selectionText =
    week && (metrics || week.data_gap)
      ? `${region === "Perú" ? "Área de estudio alrededor de Perú" : region}, ${weekRange(week)} de ${year}. ${week.data_gap ? "Datos insuficientes." : `${number(metrics?.count ?? 0)} focos de calor. ${LEVEL_LABEL[metrics?.level ?? "no_data"]}. Anomalía z ${metrics?.z?.toFixed(2)}.`}`
      : "";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar a la exploración
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => navigate("explorer")}
          aria-label="TerraEcho, ir al explorador"
        >
          <span className="brand-mark">
            <Icon name="globe" size={30} />
            <span />
          </span>
          <span>
            terra<span className="brand-light">echo</span>
            <small>LISTEN TO OUR PLANET</small>
          </span>
        </button>
        <nav className="top-nav" aria-label="Navegación principal">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              {n.label}
              {view === n.id && <span />}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="mission-tag">
            NASA SPACE APPS <b>2026</b>
          </span>
          <button
            className="access-button"
            onClick={() => setDialog("accessibility")}
            aria-label="Opciones y guía de accesibilidad"
          >
            <Icon name="headphones" size={18} />
            <span>Accesibilidad</span>
          </button>
        </div>
      </header>
      <div className="app-grid">
        <aside className="rail" aria-label="Herramientas de navegación">
          <div className="rail-top">
            <span className="rail-label">MISIÓN</span>
            {NAV.map((n) => (
              <button
                key={n.id}
                className={`rail-button ${view === n.id ? "active" : ""}`}
                title={n.label}
                aria-label={n.label}
                aria-pressed={view === n.id}
                onClick={() => navigate(n.id)}
              >
                <Icon name={n.icon} size={22} />
                <small>{n.index}</small>
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <span className="rail-coordinate">12.0° S · 77.0° W</span>
            <button
              className="rail-button"
              title="Fuentes y conexión API"
              aria-label="Fuentes y conexión API"
              onClick={() => setDialog("sources")}
            >
              <Icon name="layers" size={20} />
            </button>
            <button
              className="rail-button"
              title="Cómo funciona TerraEcho"
              aria-label="Cómo funciona TerraEcho"
              onClick={() => setDialog("method")}
            >
              <Icon name="info" size={21} />
            </button>
          </div>
        </aside>
        <main
          id="main"
          className={`main-stage ${view !== "explorer" ? "scroll-stage" : ""}`}
          tabIndex={-1}
        >
          {view === "explorer" ? (
            <section
              className="explorer-view"
              aria-label="Explorador de la Tierra"
            >
              <div className="earth-viewport">
                <Globe
                  cells={cells}
                  geo={geo}
                  layers={layers}
                  rotating={rotating}
                  resetKey={resetKey}
                  zoom={zoom}
                  onInspect={setInspected}
                />
              </div>
              {map2d && (
                <div className="flat-map">
                  <PeruMap cells={cells} geo={geo} onInspect={setInspected} />
                </div>
              )}
              <div className="stage-top">
                <div className="section-kicker">
                  <span className="small-orb" />
                  EARTH INFORMATION JUKEBOX
                </div>
                <span className="coordinates mono">
                  ÓRBITA DE EXPLORACIÓN / PERÚ
                </span>
              </div>
              <div className="hero-copy">
                <span className="outline-tag">
                  EL SONIDO DE UN PLANETA VIVO
                </span>
                <h1>
                  La Tierra tiene
                  <br />
                  algo que decir.
                  <br />
                  <em>Escúchala.</em>
                </h1>
                <p>
                  El fuego deja una señal.
                  <br />
                  Transformamos datos satelitales
                  <br />
                  en una experiencia que puedes sentir.
                </p>
                <button
                  className={`primary-button ${sound ? "listening" : ""}`}
                  onClick={toggleSound}
                  disabled={!week}
                  aria-pressed={sound}
                >
                  <Icon name={sound ? "pause" : "headphones"} size={18} />
                  {sound ? "Pausar escucha" : "Escuchar la Tierra"}
                  <Icon name="arrow" size={16} />
                </button>
                <span className="hero-footnote">
                  NASA FIRMS + EARTH INFORMATION CENTER
                </span>
              </div>
              <div className="globe-location">
                <span className="location-pin" />
                <div>
                  <strong>Perú</strong>
                  <span>Una historia que merece ser escuchada.</span>
                </div>
              </div>
              <div className="map-toolbar">
                <div
                  className="map-mode"
                  role="group"
                  aria-label="Tipo de visualización"
                >
                  <button
                    onClick={() => setMap2d(false)}
                    aria-pressed={!map2d}
                    className={!map2d ? "active" : ""}
                  >
                    3D
                  </button>
                  <button
                    onClick={() => setMap2d(true)}
                    aria-pressed={map2d}
                    className={map2d ? "active" : ""}
                  >
                    2D
                  </button>
                </div>
                <div className="tool-stack">
                  <button
                    className="icon-button"
                    aria-label="Acercar globo"
                    title="Acercar"
                    disabled={map2d}
                    onClick={() => setZoom((z) => Math.min(5, z + 1))}
                  >
                    <Icon name="plus" size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Alejar globo"
                    title="Alejar"
                    disabled={map2d}
                    onClick={() => setZoom((z) => Math.max(-4, z - 1))}
                  >
                    <Icon name="minus" size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Restablecer vista de Perú"
                    title="Restablecer vista"
                    onClick={() => {
                      setResetKey((n) => n + 1);
                      setZoom(0);
                    }}
                  >
                    <Icon name="reset" size={16} />
                  </button>
                </div>
                <button
                  className="icon-button tool-single"
                  onClick={() => setRotating((v) => !v)}
                  aria-label={
                    rotating
                      ? "Pausar movimiento de la escena"
                      : "Activar movimiento de la escena"
                  }
                  aria-pressed={rotating}
                  title={rotating ? "Pausar movimiento" : "Activar movimiento"}
                >
                  <Icon name={rotating ? "pause" : "play"} size={16} />
                </button>
                <button
                  className="icon-button tool-single"
                  onClick={() => setShowLayers((v) => !v)}
                  aria-label="Configurar capas del globo"
                  aria-expanded={showLayers}
                  title="Capas"
                >
                  <Icon name="layers" size={18} />
                </button>
              </div>
              {showLayers && (
                <div className="layer-menu">
                  <span className="micro">CAPAS DE EXPLORACIÓN</span>
                  {[
                    { id: "fires", label: "Focos de calor" },
                    { id: "orbits", label: "Órbitas ilustrativas" },
                    { id: "waves", label: "Ondas ilustrativas" },
                  ].map((l) => (
                    <label key={l.id}>
                      <input
                        type="checkbox"
                        checked={layers[l.id as keyof GlobeLayers]}
                        onChange={(e) =>
                          setLayers((v) => ({ ...v, [l.id]: e.target.checked }))
                        }
                      />
                      {l.label}
                    </label>
                  ))}
                </div>
              )}
              {inspected && (
                <div className="cell-tooltip">
                  <button
                    className="icon-button"
                    aria-label="Cerrar detalle de la celda"
                    onClick={() => setInspected(null)}
                  >
                    <Icon name="cross" size={14} />
                  </button>
                  <span className="micro">
                    CELDA 0.5° / {inspected.lat}°, {inspected.lon}°
                  </span>
                  <strong>{number(inspected.count)} focos de calor</strong>
                  <span style={{ color: LEVEL_COLOR[inspected.level] }}>
                    {LEVEL_LABEL[inspected.level]} · z {inspected.z?.toFixed(2)}
                  </span>
                  <small>FRP acumulada: {number(inspected.frp)} MW</small>
                </div>
              )}
              <div className="scene-legend">
                <span>
                  <i style={{ background: LEVEL_COLOR.normal }} />
                  Habitual
                </span>
                <span>
                  <i style={{ background: LEVEL_COLOR.elevated }} />
                  Elevada
                </span>
                <span>
                  <i style={{ background: LEVEL_COLOR.critical }} />
                  Crítica
                </span>
                <small>Arrastra para orbitar · toca un foco</small>
              </div>
              <div className="sound-dock">
                <div
                  className={`sound-symbol ${sound ? "active" : ""}`}
                  aria-hidden="true"
                >
                  {Array.from({ length: 15 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${(6 + Math.abs(Math.sin(i * 0.9)) * 23).toFixed(2)}px`,
                        animationDelay: `${(i * 0.07).toFixed(2)}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="sound-dock-copy">
                  <span className="micro">
                    {sound
                      ? "SONIFICACIÓN ACTIVA"
                      : "DALE VOLUMEN A LA CIENCIA"}
                  </span>
                  <span>
                    {week?.data_gap
                      ? "Sin datos suficientes · silencio"
                      : sound
                        ? `${region} · ${metrics ? LEVEL_LABEL[metrics.level] : "sin datos"}`
                        : "Hay historias que los ojos no alcanzan a contar."}
                  </span>
                </div>
                <button
                  className="voice-button"
                  aria-label={
                    speaking
                      ? "Detener lectura de la selección"
                      : "Leer selección en voz alta"
                  }
                  onClick={readSelection}
                  disabled={!week || (!metrics && !week.data_gap)}
                  aria-pressed={speaking}
                >
                  <Icon name={speaking ? "pause" : "volume"} size={17} />
                  <span>{speaking ? "Detener voz" : "Leer selección"}</span>
                </button>
              </div>
            </section>
          ) : view === "history" ? (
            score ? (
              <Temporal
                score={score}
                index={datasetIndex}
                region={region}
                onChange={setIndex}
              />
            ) : (
              <div className="loading-state">
                {loading
                  ? "Cargando observatorio…"
                  : "El observatorio necesita el archivo de datos."}
              </div>
            )
          ) : (
            <EicStudio />
          )}
          {loading && view !== "eic" && (
            <div className="data-loading" role="status">
              <span className="status-dot" />
              Cargando archivo satelital…
            </div>
          )}
          {error && view !== "eic" && (
            <div className="data-error" role="alert">
              <strong>No se pudo cargar el archivo.</strong>
              <span>{error}</span>
              <button onClick={retry} className="secondary-button">
                Reintentar
                <Icon name="reset" size={15} />
              </button>
            </div>
          )}
        </main>
        <aside className="signal-panel" aria-label="Datos de la selección">
          <div className="panel-header">
            <span className="micro">
              {view === "eic"
                ? "LA CIENCIA DETRÁS DEL SONIDO"
                : "SEÑAL DE LA SEMANA"}
            </span>
            <span className="panel-index">{view === "eic" ? "02" : "01"}</span>
          </div>
          {view === "eic" ? (
            <div className="eic-sidebar">
              <span className="outline-tag">IMAGEN → SONIDO</span>
              <h2>
                La Tierra,
                <br />
                en otra frecuencia.
              </h2>
              <p>
                Una imagen del EIC se convierte en una partitura de 104 pasos.
                Las cuatro capas se pueden escuchar juntas o por separado.
              </p>
              <div className="sidebar-step">
                <span>01</span>
                <div>
                  <strong>Color → instrumento</strong>
                  <p>Cada aerosol tiene un timbre.</p>
                </div>
              </div>
              <div className="sidebar-step">
                <span>02</span>
                <div>
                  <strong>Altura → tono</strong>
                  <p>De notas graves a agudas.</p>
                </div>
              </div>
              <div className="sidebar-step">
                <span>03</span>
                <div>
                  <strong>Barrido → estéreo</strong>
                  <p>Del oeste hacia el este.</p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => setDialog("sources")}
              >
                Explorar la fuente
                <Icon name="arrow" size={15} />
              </button>
              <p className="panel-caveat">
                El frame EIC tiene su propia fecha y escala global. No
                representa el humo de la semana seleccionada en Perú.
              </p>
            </div>
          ) : (
            <>
              <label className="region-field">
                <span>REGIÓN DE ESCUCHA</span>
                <select
                  aria-label="Región de escucha"
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setInspected(null);
                  }}
                  disabled={!geo}
                >
                  <option value="Perú">Área de estudio · Perú (bbox)</option>
                  {geo?.features
                    .map((f) => f.properties.shapeName)
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="observation-date">
                <span>{week ? weekRange(week) : "—"}</span>
                <small>
                  {year} / SEMANA {String(datasetIndex + 1).padStart(2, "0")}
                </small>
              </div>
              <div
                className="level-badge"
                style={
                  {
                    "--signal": LEVEL_COLOR[metrics?.level ?? "no_data"],
                  } as React.CSSProperties
                }
              >
                <span />
                {week?.data_gap
                  ? "Sin datos suficientes"
                  : metrics
                    ? LEVEL_LABEL[metrics.level]
                    : "Esperando datos"}
                <Icon
                  name={metrics?.level === "critical" ? "wave" : "info"}
                  size={14}
                />
              </div>
              <div className="main-metric">
                <span className="micro">FOCOS DE CALOR DETECTADOS</span>
                <strong>
                  {metrics ? number(metrics.count) : "—"}
                  <span>↗</span>
                </strong>
                <p>
                  {week?.data_gap
                    ? "Conteo parcial · no interpretable"
                    : region === "Perú"
                      ? "Caja geográfica: puede incluir territorio vecino."
                      : "Detecciones satelitales, no incendios individuales."}
                </p>
              </div>
              <div className="paired-metrics">
                <div>
                  <span className="micro">ANOMALÍA ROBUSTA</span>
                  <strong
                    style={{ color: LEVEL_COLOR[metrics?.level ?? "no_data"] }}
                  >
                    {metrics?.z != null
                      ? `${metrics.z > 0 ? "+" : ""}${metrics.z.toFixed(2)}`
                      : "—"}
                    <small> z</small>
                  </strong>
                </div>
                <div>
                  <span className="micro">FRP ACUMULADA</span>
                  <strong>
                    {metrics ? number(metrics.frp) : "—"}
                    <small> MW*</small>
                  </strong>
                </div>
              </div>
              {score && (
                <div className="mini-chart-wrap">
                  <div>
                    <span>Contexto del área de estudio</span>
                    <span>{year}</span>
                  </div>
                  <MiniChart weeks={score.weeks} index={datasetIndex} />
                </div>
              )}
              <div className="region-list-header">
                <span className="micro">REGIONES EN FOCO</span>
                <Icon name="fire" size={14} />
              </div>
              <div className="region-list">
                {sortedRegions.slice(0, 3).map((r, i) => (
                  <button
                    key={r.name}
                    className={r.name === region ? "selected" : ""}
                    onClick={() =>
                      setRegion(region === r.name ? "Perú" : r.name)
                    }
                    aria-pressed={r.name === region}
                  >
                    <span className="region-rank">0{i + 1}</span>
                    <span>
                      {r.name}
                      <small>{LEVEL_LABEL[r.level]}</small>
                    </span>
                    <strong>{number(r.count)}</strong>
                    <Icon name="chevron" size={12} />
                  </button>
                ))}
                {week?.data_gap && (
                  <p className="panel-caveat">
                    Sin desglose regional: esta semana presenta un hueco de
                    datos.
                  </p>
                )}
              </div>
              <p className="metric-footnote">
                * Suma de FRP de las detecciones semanales; no es potencia
                simultánea ni área quemada.
              </p>
            </>
          )}
          <div className="panel-bottom">
            {view !== "eic" && (
              <button className="eic-teaser" onClick={() => navigate("eic")}>
                <span className="eic-thumb">
                  <Icon name="wave" size={24} />
                </span>
                <span>
                  <small>DESCUBRE OTRA PISTA</small>
                  <strong>El planeta, en cuatro voces</strong>
                  <em>Aerosoles · NASA EIC</em>
                </span>
                <Icon name="arrow" size={17} />
              </button>
            )}
            <button
              className="source-status"
              onClick={() => setDialog("sources")}
            >
              <span className="status-dot" />
              <span>
                Archivo NASA ·{" "}
                {year === 2026 ? "datos provisionales" : "serie 2025"}
              </span>
              <Icon name="external" size={12} />
            </button>
          </div>
        </aside>
        <div className="lower-deck">
          {view !== "eic" && score ? (
            <Timeline
              score={score}
              index={datasetIndex}
              region={region}
              onChange={(n) => {
                setIndex(n);
                setPlaying(false);
              }}
              playing={playing}
              onPlay={toggleJourney}
              year={year}
              onYear={changeYear}
              onExport={exportCsv}
            />
          ) : (
            <div className="eic-bottom">
              <Icon name="headphones" size={25} />
              <div>
                <strong>La ciencia también se escucha.</strong>
                <span>
                  Usa audífonos para percibir la posición estéreo de cada capa.
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => setDialog("method")}
              >
                Conoce la gramática sonora
                <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      <footer className="footer">
        <span>HECHO PARA ESCUCHAR. CREADO PARA ENTENDER.</span>
        <div>
          <span>
            Un proyecto de <b>ASTRACOM</b>
          </span>
          <span className="footer-divider" />
          <button onClick={() => setDialog("sources")}>
            NASA FIRMS + EIC
            <Icon name="external" size={10} />
          </button>
          <a
            href="https://github.com/Yamile26/TerraEcho"
            target="_blank"
            rel="noreferrer"
          >
            Ver código
            <Icon name="external" size={10} />
          </a>
        </div>
      </footer>
      {view !== "eic" && sound && (
        <div className="volume-float">
          <button onClick={toggleSound} aria-label="Silenciar sonificación">
            <Icon name="volume" size={17} />
          </button>
          <input
            aria-label="Volumen de la sonificación"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
          />
          <span>{Math.round(volume * 100)}%</span>
        </div>
      )}
      {audioError && (
        <div className="toast" role="alert">
          {audioError}
          <button
            className="icon-button"
            onClick={() => setAudioError("")}
            aria-label="Cerrar aviso"
          >
            <Icon name="cross" size={15} />
          </button>
        </div>
      )}
      <p
        className="sr-only"
        aria-live={playing ? "off" : "polite"}
        aria-atomic="true"
      >
        {view === "eic"
          ? "Estudio EIC. Visualización de aerosoles, 19 de agosto de 2025."
          : selectionText}
      </p>
      {dialog && <InfoDialog kind={dialog} onClose={closeDialog} />}
    </div>
  );
}
