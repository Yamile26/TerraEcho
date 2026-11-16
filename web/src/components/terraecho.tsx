"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useListeningPreferences } from "@/hooks/use-listening-preferences";
import { Sonifier } from "@/lib/audio";
import { PALETTE } from "@/lib/theme";
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
import { useDataset, useGeography, useCatalog } from "@/hooks/use-dataset";
import type { CellVoice, FireWeek } from "@/lib/types";
import type { GlobeLayers } from "./globe";
import { PeruMap } from "./globe";
import { Icon, type IconName } from "./icon";
import { Timeline } from "./timeline";
import { Temporal } from "./temporal";
import { EicStudio } from "./eic-studio";
import { RecentStudio } from "./recent-studio";
import { CellTable } from "./cell-table";
import {
  readSelection as readUrlSelection,
  shareUrl,
  type TerraView,
} from "@/lib/navigation";
import { representation } from "@/lib/recent";
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
type View = TerraView;
const NAV: { id: View; label: string; icon: IconName; index: string }[] = [
  { id: "explorer", label: "Explorar la Tierra", icon: "globe", index: "01" },
  { id: "history", label: "Observatorio", icon: "chart", index: "02" },
  { id: "eic", label: "Jukebox EIC", icon: "wave", index: "03" },
  { id: "recent", label: "Datos recientes", icon: "satellite", index: "04" },
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
          <stop stopColor={PALETTE.accent} stopOpacity=".18" />
          <stop offset="1" stopColor={PALETTE.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,55 ${pts} 260,55`} fill="url(#sparkfill)" />
      <polyline
        points={pts}
        fill="none"
        stroke={PALETTE.boundaries}
        strokeWidth="1.4"
      />
      <line
        x1={(index / (weeks.length - 1)) * 260}
        x2={(index / (weeks.length - 1)) * 260}
        y1="0"
        y2="56"
        stroke={PALETTE.accent}
        strokeDasharray="2 3"
      />
      <circle
        cx={(index / (weeks.length - 1)) * 260}
        cy={49 - (weeks[index].country.count / max) * 43}
        r="3.2"
        fill={PALETTE.accent}
      />
    </svg>
  );
}
export function TerraEcho() {
  const [view, setView] = useState<View>("explorer"),
    [year, setYear] = useState(2025),
    [index, setIndex] = useState(39),
    [region, setRegion] = useState("Perú");
  const { score, error, loading, retry } = useDataset(year);
  const geography = useGeography(),
    geo = geography.geo;
  const { catalog, error: catalogError } = useCatalog();
  const [navigationReady, setNavigationReady] = useState(false);
  const datasetEntry = catalog?.entries.find((e) => e.year === year);
  const isNational =
    score?.meta.geographic_scope === "peru-admin1-point-clipped";

  const [sound, setSound] = useState(false),
    [playing, setPlaying] = useState(false),
    [audioError, setAudioError] = useState("");
  const { volume, setVolume, mono, setMono } = useListeningPreferences();
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
  const mix = representation(cells);
  useEffect(() => {
    const s = readUrlSelection(location.search);
    setView(s.view);
    setYear(s.year);
    setIndex(s.week);
    setRegion(s.region);
    setNavigationReady(true);
  }, []);
  useEffect(() => {
    if (!navigationReady) return;
    const p = new URLSearchParams(location.search),
      extra: Record<string, string> = {};
    if (view === "eic")
      for (const k of ["piece", "step", "layers", "mono"])
        if (p.has(k)) extra[k] = p.get(k)!;
    history.replaceState(
      null,
      "",
      shareUrl(location.origin, location.pathname, {
        view,
        year,
        week: index,
        region,
        ...extra,
      }),
    );
  }, [navigationReady, view, year, index, region]);
  useEffect(() => {
    if (
      geo &&
      region !== "Perú" &&
      !geo.features.some((f) => f.properties.shapeName === region)
    )
      setRegion("Perú");
  }, [geo, region]);
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
    engine.current?.setMono(mono);
  }, [volume, mono]);
  useEffect(() => {
    engine.current?.stop();
    if (!sound || !week || view === "eic" || view === "recent") return;
    const synth = () => engine.current?.fire(week, cells, region === "Perú");
    synth();
    const timer = setInterval(synth, 1400);
    return () => {
      clearInterval(timer);
      engine.current?.stop();
    };
  }, [sound, week, cells, region, view]);
  useEffect(() => {
    if (!playing || !score || view === "eic" || view === "recent") return;
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
    window.speechSynthesis?.cancel();
    setSpeaking(false);
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
  async function listenCell(c: CellVoice) {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setSound(false);
    setPlaying(false);
    engine.current?.stop();
    try {
      await engine.current?.enable();
      engine.current?.volume(volume);
      if (week) engine.current?.fire(week, [c], false);
    } catch {
      setAudioError("No se pudo iniciar la escucha de esta celda.");
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
    const message = `${region === "Perú" ? (isNational ? "Perú, límites departamentales simplificados" : "Área de estudio alrededor de Perú") : region}. Semana del ${dateLabel(week.start_date, true)} de ${year}. ${week.data_gap ? "Datos insuficientes. No se interpreta como calma." : `${number(metrics?.count ?? 0)} focos de calor detectados. ${LEVEL_LABEL[metrics?.level ?? "no_data"]}. Anomalía ${metrics?.z?.toFixed(2)}. Los focos no equivalen a incendios individuales.`}`;
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
      ? `${region === "Perú" ? (isNational ? "Perú, límites departamentales simplificados" : "Área de estudio alrededor de Perú") : region}, ${weekRange(week)} de ${year}. ${week.data_gap ? "Datos insuficientes." : `${number(metrics?.count ?? 0)} focos de calor. ${LEVEL_LABEL[metrics?.level ?? "no_data"]}. Anomalía z ${metrics?.z?.toFixed(2)}.`}`
      : "";
  const regionField = (
    <label className="region-field">
      <span>Departamento</span>
      <select
        aria-label="Región de escucha"
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
          setInspected(null);
        }}
        disabled={!geo}
      >
        <option value="Perú">Toda el área de estudio</option>
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
  );
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
            Terra<span className="brand-light">Echo</span>
            <small>SATÉLITES · CIENCIA · SONIDO</small>
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
          <button
            className="sources-nav"
            onClick={() => setDialog("sources")}
            aria-label="Fuentes y metodología, conexión API"
          >
            Fuentes y metodología
          </button>
        </nav>
        <div className="topbar-right">
          <span className="mission-tag">
            NASA SPACE APPS <b>2026</b>
          </span>
          <button
            className="access-button"
            onClick={() => setDialog("accessibility")}
            aria-label="Accesibilidad, opciones y guía"
          >
            <Icon name="headphones" size={18} />
            <span>Accesibilidad</span>
          </button>
        </div>
      </header>
      <div className={`app-grid view-${view}`}>
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
                <span className="outline-tag">PERÚ / ARCHIVO 2012–2025</span>
                <h1>
                  Escucha las
                  <br />
                  <em>señales de Perú.</em>
                </h1>
                <p>
                  Imágenes NASA y focos térmicos se convierten en una
                  experiencia para explorar y escuchar.
                </p>
                <button
                  className="primary-button eic-entry"
                  onClick={() => navigate("eic")}
                >
                  <Icon name="headphones" size={17} />
                  Escuchar una imagen EIC
                  <Icon name="arrow" size={15} />
                </button>
                <div className="geography-card">
                  <span className="micro">EXPLORACIÓN GEOGRÁFICA</span>
                  <div className="country-field">
                    <span>País</span>
                    <div className="country-value">
                      <Icon name="globe" size={14} />
                      Perú
                    </div>
                  </div>
                  {regionField}
                  <small>
                    {region === "Perú"
                      ? isNational
                        ? "Ámbito: Perú, límites ADM1 simplificados."
                        : score
                          ? "Legado 2026: caja geográfica, sin reproducir."
                          : "Cargando ámbito del archivo…"
                      : `Departamento: ${region}.`}
                  </small>
                </div>
                <span className="hero-footnote">
                  MONITOREO PARA EXPLORAR, NO PARA ALERTAR
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
          ) : view === "eic" ? (
            <EicStudio />
          ) : (
            <RecentStudio geo={geo} />
          )}
          {loading && (view === "explorer" || view === "history") && (
            <div className="data-loading" role="status">
              <span className="status-dot" />
              Cargando archivo satelital…
            </div>
          )}
          {error && (view === "explorer" || view === "history") && (
            <div className="data-error" role="alert">
              <strong>No se pudo cargar el archivo.</strong>
              <span>{error}</span>
              <button onClick={retry} className="secondary-button">
                Reintentar
                <Icon name="reset" size={15} />
              </button>
            </div>
          )}
          {geography.error && view !== "eic" && (
            <p className="error-message" role="alert">
              {geography.error}
              <button className="secondary-button" onClick={geography.retry}>
                Reintentar límites
              </button>
            </p>
          )}
          {catalogError && view !== "eic" && (
            <p className="source-warning">{catalogError}</p>
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
                  <p>De izquierda a derecha en la imagen.</p>
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
              {view === "history" && regionField}
              <p className="archive-quality">
                {datasetEntry?.quality === "legacy-unreproduced"
                  ? "2026 · Exportación heredada: CSV de origen y cobertura sin reproducir. No comparar sus cifras con el archivo nacional regenerado."
                  : "Archivo NASA SP regenerado · actividad térmica de vegetación. Sin clasificación forestal; cobertura de nubes no certificada."}
              </p>
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
                      ? isNational
                        ? "Perú: registros asignados por punto a límites ADM1 simplificados."
                        : "Legado: caja geográfica; puede incluir territorio vecino."
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
            {(view === "explorer" || view === "history") && (
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
                {view === "eic"
                  ? "Imagen NASA · SVS 5669 · 2025"
                  : `Archivo NASA · ${year === 2026 ? "legado sin reproducir" : `archivo SP ${year}`}`}
              </span>
              <Icon name="external" size={12} />
            </button>
          </div>
        </aside>
        <div className="lower-deck">
          {(view === "explorer" || view === "history") && score ? (
            <Timeline
              catalog={catalog}
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
          {(view === "explorer" || view === "history") && (
            <section
              className={`sound-dock ${week?.data_gap ? "no-signal" : ""}`}
              aria-label="Estudio de sonificación"
            >
              <div className="sound-dock-heading">
                <span className="micro">
                  <Icon name="wave" size={15} />
                  ESTUDIO DE SONIFICACIÓN
                </span>
                <span>
                  Escucha patrones de detección a lo largo del tiempo.
                </span>
                <button
                  className="text-button"
                  onClick={() => setDialog("method")}
                >
                  ¿Cómo se convierte en sonido?
                  <Icon name="info" size={14} />
                </button>
              </div>
              <div className="sound-dock-body">
                <button
                  className={`play-button ${sound ? "is-playing" : ""}`}
                  onClick={toggleSound}
                  disabled={!week || week.data_gap || !cells.length}
                  aria-label={sound ? "Pausar escucha" : "Escuchar la Tierra"}
                  aria-pressed={sound}
                >
                  <Icon name={sound ? "pause" : "play"} size={21} />
                </button>
                <div className="sound-dock-copy">
                  <strong>
                    {region === "Perú"
                      ? "Focos de calor · Perú"
                      : `Señales de ${region}`}
                  </strong>
                  <span>
                    {week
                      ? `${weekRange(week)} · ${year}`
                      : "Preparando la selección…"}
                  </span>
                  <small role="status">
                    {!week
                      ? "CARGANDO DATOS"
                      : week.data_gap
                        ? "DATOS INSUFICIENTES · SILENCIO"
                        : !cells.length
                          ? "SIN DETECCIONES EN LA SELECCIÓN · SILENCIO"
                          : sound
                            ? "SONIFICACIÓN ACTIVA"
                            : "LISTO PARA ESCUCHAR"}
                  </small>
                </div>
                <div
                  className={`sound-symbol ${sound ? "active" : ""}`}
                  aria-hidden="true"
                >
                  {Array.from({ length: 76 }, (_, i) => {
                    const gain = cells.length
                      ? cells[i % cells.length].gain
                      : 0;
                    return (
                      <i
                        key={i}
                        style={{
                          height: `${(week?.data_gap ? 3 : 4 + gain * 25 + Math.abs(Math.sin(i * 0.76)) * 9).toFixed(2)}px`,
                          animationDelay: `${(i * 0.027).toFixed(2)}s`,
                        }}
                      />
                    );
                  })}
                </div>
                <label className="dock-volume">
                  <span>
                    Volumen <b>{Math.round(volume * 100)} %</b>
                  </span>
                  <span>
                    <Icon name="volume" size={14} />
                    <input
                      aria-label="Volumen de la sonificación"
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={volume}
                      onChange={(e) => setVolume(+e.target.value)}
                    />
                  </span>
                </label>
                <button
                  className="secondary-button"
                  aria-pressed={mono}
                  onClick={() => setMono((v) => !v)}
                >
                  {mono ? "Mono activo" : "Estéreo"}
                </button>
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
                  <Icon name={speaking ? "pause" : "headphones"} size={16} />
                  <span>{speaking ? "Detener voz" : "Leer selección"}</span>
                </button>
              </div>
              <div className="sound-dock-footer">
                <span>DEL DATO AL SONIDO</span>
                <span>Detecciones → ritmo</span>
                <span>
                  {mix.voices}/{mix.cells} celdas ·{" "}
                  {Math.round(mix.countShare * 100)} % de detecciones ·{" "}
                  {Math.round((mix.frpShare ?? 0) * 100)} % de FRP conocida en
                  la mezcla
                </span>
                <span>Anomalía → disonancia</span>
                <span>
                  <Icon name="headphones" size={12} />
                  Mejor con audífonos
                </span>
              </div>
            </section>
          )}
          {(view === "explorer" || view === "history") && (
            <CellTable
              cells={cells}
              onInspect={setInspected}
              onListen={listenCell}
              onStop={() => engine.current?.stop()}
            />
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
