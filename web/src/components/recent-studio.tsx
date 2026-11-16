"use client";
import { useListeningPreferences } from "@/hooks/use-listening-preferences";
import { useEffect, useMemo, useRef, useState } from "react";
import { FIRMS_SOURCES, type FirmsSource } from "@/lib/firms";
import type { RecentData } from "@/lib/firms-provider";
import { recentCells, representation } from "@/lib/recent";
import { Sonifier } from "@/lib/audio";
import { number } from "@/lib/data";
import type { CellVoice, GeoCollection } from "@/lib/types";
import { PeruMap } from "./globe";
import { Icon } from "./icon";
import { ARCHIVE_ONLY } from "@/lib/build-mode";
export function RecentStudio({ geo }: { geo: GeoCollection | null }) {
  const [source, setSource] = useState<FirmsSource>("VIIRS_NOAA20_NRT"),
    [days, setDays] = useState(3),
    [date, setDate] = useState("");
  const [data, setData] = useState<RecentData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [region, setRegion] = useState("Perú"),
    [inspected, setInspected] = useState<CellVoice | null>(null),
    [playing, setPlaying] = useState(false),
    [page, setPage] = useState(0);
  const { volume, setVolume, mono, setMono } = useListeningPreferences();
  const engine = useRef<Sonifier | null>(null),
    request = useRef<AbortController | null>(null);
  const observations = useMemo(
    () =>
      data?.observations.filter(
        (o) => region === "Perú" || o.region === region,
      ) ?? [],
    [data, region],
  );
  const cells = useMemo(() => recentCells(observations), [observations]),
    mix = representation(cells, "count");
  useEffect(() => {
    engine.current = new Sonifier();
    return () => {
      engine.current?.dispose();
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    engine.current?.volume(volume);
    engine.current?.setMono(mono);
  }, [volume, mono]);
  useEffect(() => {
    engine.current?.stop();
    if (!playing || !cells.length) return;
    engine.current?.recent(cells);
    const t = setInterval(() => engine.current?.recent(cells), 1400);
    return () => {
      clearInterval(t);
      engine.current?.stop();
    };
  }, [playing, cells]);
  useEffect(() => {
    const h = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);
  async function query() {
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    setError("");
    setPlaying(false);
    setData(null);
    setInspected(null);
    setPage(0);
    try {
      const p = new URLSearchParams({
        mode: "live",
        source,
        days: String(days),
      });
      if (date) p.set("date", date);
      const r = await fetch(`/api/fires?${p}`, { signal: c.signal }),
        d = await r.json();
      if (!r.ok)
        throw new Error(d.error?.message ?? "No se pudo consultar FIRMS.");
      if (
        !Array.isArray(d.observations) ||
        d.meta?.anomalyComputed !== false ||
        d.observations.some(
          (o: Record<string, unknown>) =>
            !Number.isFinite(o.latitude) || !Number.isFinite(o.longitude),
        )
      )
        throw new Error("Respuesta reciente incompatible.");
      setData(d);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  async function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    try {
      await engine.current?.enable();
      engine.current?.volume(volume);
      setPlaying(true);
    } catch {
      setError("Pulsa escuchar otra vez para activar el audio.");
    }
  }
  const frp = observations
    .filter((o) => o.frp !== null)
    .reduce((s, o) => s + o.frp!, 0);
  if (ARCHIVE_ONLY)
    return (
      <section className="recent-view" aria-labelledby="recent-title">
        <div className="section-kicker">NASA FIRMS · CONSULTA RECIENTE</div>
        <h1 id="recent-title">
          Explora el archivo.
          <br />
          <em>Conecta lo reciente en tu servidor.</em>
        </h1>
        <p>
          Esta demo contiene imágenes EIC y el archivo 2012–2025, más el
          exportado heredado de 2026 identificado aparte. Las consultas
          recientes están disponibles en la versión con servidor; necesitan una
          clave FIRMS privada configurada allí.
        </p>
        <a
          className="source-link"
          href="https://github.com/Yamile26/TerraEcho/blob/feat/terraecho-web-experience/docs/DEPLOYMENT.md"
          target="_blank"
          rel="noreferrer"
        >
          Abrir guía de conexión y despliegue
        </a>
      </section>
    );
  return (
    <section className="recent-view" aria-labelledby="recent-title">
      <div className="section-kicker">
        <span className="small-orb" />
        NASA FIRMS · CONSULTA RECIENTE
      </div>
      <h1 id="recent-title">
        Una ventana reciente.
        <br />
        <em>Su procedencia, a la vista.</em>
      </h1>
      <p>
        Consulta focos térmicos dentro de límites departamentales simplificados
        de Perú. Estos datos no tienen anomalía histórica ni clasificación
        forestal.
      </p>
      <div className="recent-query">
        <label>
          Producto
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as FirmsSource)}
          >
            {Object.entries(FIRMS_SOURCES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ventana
          <select value={days} onChange={(e) => setDays(+e.target.value)}>
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "día" : "días"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inicio opcional
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="primary-button" onClick={query} disabled={loading}>
          {loading ? "Consultando NASA…" : "Consultar FIRMS"}
          <Icon name="satellite" size={17} />
        </button>
      </div>
      <p className="source-warning">
        Suomi NPP deja de aportar observaciones nuevas el 2 nov 2026. NOAA-20/21
        se consultan como productos separados; sus conteos no se comparan
        automáticamente con el baseline Suomi NPP.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error} El archivo histórico y las imágenes EIC siguen disponibles.
        </p>
      )}
      {!data && !loading && !error && (
        <p className="empty-state">
          Elige el producto y consulta una ventana. Tu MAP_KEY permanece en el
          servidor.
        </p>
      )}
      {data && (
        <>
          <div className="recent-meta">
            <span>{data.meta.source}</span>
            <strong>
              {data.meta.startDate} → {data.meta.endDate} UTC
            </strong>
            <span>Consultado: {data.meta.retrievedAt}</span>
            <span>
              Disponibilidad:{" "}
              {data.meta.availability.status === "reported-range"
                ? `${data.meta.availability.start} → ${data.meta.availability.end}`
                : "intervalo del producto sin confirmar"}
            </span>
          </div>
          <p role="status" className="source-warning">
            {data.observations.length
              ? `${number(data.observations.length)} detecciones dentro del ámbito.`
              : "NASA devolvió cero detecciones para esta ventana y ámbito. No se interpreta como ausencia de fuego."}{" "}
            La cobertura de nubes y pasadas no está certificada. Fuera de
            límites simplificados: {number(data.meta.excludedOutsideCount)}{" "}
            registros.
          </p>
          <label className="region-field">
            Departamento
            <select
              aria-label="Departamento de consulta reciente"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setPlaying(false);
                setInspected(null);
                setPage(0);
              }}
            >
              <option value="Perú">Todos los departamentos</option>
              {geo?.features.map((f) => (
                <option key={f.properties.shapeName}>
                  {f.properties.shapeName}
                </option>
              ))}
            </select>
          </label>
          <div className="recent-grid">
            <div className="recent-map">
              <PeruMap cells={cells} geo={geo} onInspect={setInspected} />
            </div>
            <div className="recent-summary">
              <span className="micro">DETECCIONES REGISTRADAS</span>
              <strong>{number(observations.length)}</strong>
              <p role="status">
                {region === "Perú" ? "Todos los departamentos" : region}: {number(observations.length)} detecciones en la ventana consultada.
                {observations.length === 0 && " Cero registros no demuestra ausencia de fuego."}
              </p>
              <p>
                FRP de registros conocidos: {number(frp)} MW sumados.{" "}
                {observations.filter((o) => o.frp === null).length} con FRP
                desconocida. No es potencia simultánea ni superficie.
              </p>
              <button
                className="secondary-button"
                onClick={play}
                disabled={!cells.length}
              >
                <Icon name={playing ? "pause" : "headphones"} size={17} />
                {playing
                  ? "Pausar datos recientes"
                  : "Escuchar datos recientes"}
              </button>
              <label>
                Volumen
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                />
              </label>
              <button
                className="secondary-button"
                aria-pressed={mono}
                onClick={() => setMono((v) => !v)}
              >
                {mono ? "Mono activo" : "Estéreo"}
              </button>
              <p>
                Conteo → ritmo e intensidad relativa; latitud → tono; longitud →
                estéreo. La disonancia no representa una anomalía calculada en
                este modo.
              </p>
              <p>
                Mezcla: {mix.voices} de {mix.cells} celdas,{" "}
                {Math.round(mix.countShare * 100)} % de las detecciones
                seleccionadas.
              </p>
              {inspected && (
                <p role="status">
                  Celda agregada: {inspected.region}; {inspected.count}{" "}
                  detecciones. Latitud {inspected.lat.toFixed(2)}, longitud{" "}
                  {inspected.lon.toFixed(2)}. Anomalía no calculada.
                </p>
              )}
            </div>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Observaciones recientes"
          >
            <table>
              <caption>
                Observaciones recientes de la selección, página {page + 1}. No
                son incendios individuales.
              </caption>
              <thead>
                <tr>
                  <th>Adquisición UTC</th>
                  <th>Departamento</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th>FRP (MW)</th>
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {observations.slice(page * 50, (page + 1) * 50).map((o, i) => (
                  <tr key={`${o.acquiredAt}-${i}`}>
                    <td>{o.acquiredAt}</td>
                    <td>{o.region}</td>
                    <td>{o.latitude.toFixed(4)}</td>
                    <td>{o.longitude.toFixed(4)}</td>
                    <td>{o.frp ?? "Desconocida"}</td>
                    <td>{o.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
              Anterior
            </button>
            <span>{observations.length} registros</span>
            <button
              disabled={(page + 1) * 50 >= observations.length}
              onClick={() => setPage((n) => n + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      <a
        className="source-link"
        href="https://firms.modaps.eosdis.nasa.gov/download/"
        target="_blank"
        rel="noreferrer"
      >
        Disponibilidad y características oficiales NASA{" "}
        <Icon name="external" size={14} />
      </a>
    </section>
  );
}
