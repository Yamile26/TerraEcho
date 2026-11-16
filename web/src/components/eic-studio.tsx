"use client";
import { useEffect, useRef, useState } from "react";
import { Sonifier } from "@/lib/audio";
import { AudioTimeline } from "@/lib/transport";
import {
  EIC_LAYERS,
  describeEicStep,
  midiHz,
  midiName,
  parseEicCatalog,
  parseEicScore,
} from "@/lib/eic";
import { downloadFile, shareUrl } from "@/lib/navigation";
import type { EicCatalog, EicScore } from "@/lib/types";
import { Icon } from "./icon";
type Saved = { piece: string; step: number; layers: string[] };
export function EicStudio() {
  const [catalog, setCatalog] = useState<EicCatalog | null>(null),
    [pieceId, setPieceId] = useState("aerosols-global"),
    [score, setScore] = useState<EicScore | null>(null);
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.35),
    [mono, setMono] = useState(false);
  const [enabled, setEnabled] = useState(
      new Set<string>(EIC_LAYERS.map((l) => l.id)),
    ),
    [mask, setMask] = useState(false),
    [message, setMessage] = useState(""),
    [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState<{ A: Saved | null; B: Saved | null }>({
      A: null,
      B: null,
    }),
    [shared, setShared] = useState("");
  const engine = useRef<Sonifier | null>(null),
    timeline = useRef<AudioTimeline | null>(null),
    position = useRef(0),
    requested = useRef<Saved | null>(null),
    worker = useRef<Worker | null>(null);
  const piece = catalog?.pieces.find((p) => p.id === pieceId);
  useEffect(() => {
    engine.current = new Sonifier();
    try {
      const p = JSON.parse(localStorage.getItem("terraecho-listening") ?? "{}");
      if (typeof p.volume === "number")
        setVolume(Math.max(0, Math.min(1, p.volume)));
      if (typeof p.mono === "boolean") setMono(p.mono);
    } catch {}
    return () => {
      engine.current?.dispose();
      worker.current?.terminate();
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    fetch("/eic/pieces/catalog.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Catálogo EIC no disponible.");
        return r.json();
      })
      .then(parseEicCatalog)
      .then((d) => {
        setCatalog(d);
        const p = new URLSearchParams(location.search),
          id = p.get("piece");
        if (p.has("mono")) setMono(p.get("mono") === "true");
        if (id && d.pieces.some((t) => t.id === id)) {
          const ids = (p.get("layers") ?? "")
              .split(",")
              .filter((x) => EIC_LAYERS.some((l) => l.id === x)),
            n = Number(p.get("step") ?? 0);
          requested.current = {
            piece: id,
            layers: p.has("layers")
              ? ids
              : d.pieces.find((t) => t.id === id)!.enabled,
            step: Number.isInteger(n) ? Math.max(0, Math.min(103, n)) : 0,
          };
          setPieceId(id);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [retry]);
  useEffect(() => {
    if (!piece) return;
    const c = new AbortController();
    setPlaying(false);
    engine.current?.stop();
    setScore(null);
    setError("");
    fetch(piece.score, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Partitura EIC no disponible.");
        return r.json();
      })
      .then(parseEicScore)
      .then((d) => {
        if (
          d.meta.image_sha256 !== catalog?.source.sha256 ||
          d.meta.piece_id !== piece.id
        )
          throw new Error("La partitura no corresponde a esta imagen.");
        const next = requested.current;
        setScore(d);
        setStep(next?.piece === piece.id ? next.step : 0);
        setEnabled(
          new Set(next?.piece === piece.id ? next.layers : piece.enabled),
        );
        requested.current = null;
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [piece, catalog, retry]);
  useEffect(() => {
    position.current = step;
  }, [step]);
  useEffect(() => {
    if (!enabled.size) setPlaying(false);
  }, [enabled]);
  useEffect(() => {
    engine.current?.volume(volume);
    engine.current?.setMono(mono);
    try {
      localStorage.setItem(
        "terraecho-listening",
        JSON.stringify({ volume, mono }),
      );
    } catch {}
  }, [volume, mono]);
  useEffect(() => {
    if (!playing || !score) {
      engine.current?.stop();
      return;
    }
    const t = new AudioTimeline(
      score.steps.length,
      0.25,
      () => engine.current?.currentTime ?? 0,
    );
    timeline.current = t;
    t.start(position.current);
    const pump = () => {
      t.tick((i, delay) => engine.current?.eic(score, i, enabled, delay));
      setStep(t.position());
      if (t.ended) {
        setPlaying(false);
        setMessage(
          "Pieza terminada. Puedes repetir un segmento o comparar otra lectura.",
        );
      }
    };
    pump();
    const timer = setInterval(pump, 35);
    return () => {
      clearInterval(timer);
      position.current = t.pause();
      engine.current?.stop();
      timeline.current = null;
    };
  }, [playing, score, enabled, mono]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        setPlaying(false);
        engine.current?.stop();
        window.speechSynthesis?.cancel();
      }
    };
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, []);
  async function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!score) return;
    try {
      window.speechSynthesis?.cancel();
      await engine.current?.enable();
      engine.current?.volume(volume);
      engine.current?.setMono(mono);
      if (step >= score.steps.length - 1) {
        position.current = 0;
        setStep(0);
      }
      setPlaying(true);
      setMessage("");
    } catch {
      setError(
        "Pulsa reproducir de nuevo para activar el audio del navegador.",
      );
    }
  }
  function seek(n: number) {
    setPlaying(false);
    engine.current?.stop();
    position.current = n;
    setStep(n);
  }
  function choose(id: string) {
    setPlaying(false);
    engine.current?.stop();
    setPieceId(id);
    setMessage("Lectura seleccionada. Pulsa reproducir para escucharla.");
  }
  function save(slot: "A" | "B") {
    setSaved((s) => ({
      ...s,
      [slot]: { piece: pieceId, step, layers: [...enabled] },
    }));
    setMessage(`Selección ${slot} guardada en esta sesión.`);
  }
  function load(slot: "A" | "B") {
    const v = saved[slot];
    if (!v) return;
    setPlaying(false);
    engine.current?.stop();
    if (v.piece === pieceId) {
      seek(v.step);
      setEnabled(new Set(v.layers));
    } else {
      requested.current = v;
      setPieceId(v.piece);
    }
    setMessage(`Selección ${slot} cargada. Pulsa reproducir para comparar.`);
  }
  function read() {
    if (!score) return;
    setPlaying(false);
    if (!("speechSynthesis" in window)) {
      setMessage(
        "La descripción del segmento está disponible en la tabla de datos.",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      `${piece?.title}. Segmento ${step + 1} de ${score.steps.length}. ${describeEicStep(score, step, enabled)}. Son rasgos visuales, no concentraciones.`,
    );
    u.lang = "es-PE";
    window.speechSynthesis.speak(u);
  }
  function exportWav() {
    if (!score || exporting) return;
    setPlaying(false);
    setExporting(true);
    worker.current?.terminate();
    const w = new Worker(
      new URL("../workers/export-audio.worker.ts", import.meta.url),
    );
    worker.current = w;
    w.onmessage = (e) => {
      setExporting(false);
      if (e.data.error) setError(e.data.error);
      else {
        downloadFile(e.data.buffer, `terraecho-${pieceId}.wav`, "audio/wav");
        setMessage(
          "WAV original exportado con fuente y configuración en sus metadatos. Puedes descargar también la ficha JSON.",
        );
      }
      w.terminate();
    };
    w.onerror = () => {
      setExporting(false);
      setError("No se pudo generar el audio. Puedes continuar explorando.");
      w.terminate();
    };
    w.postMessage({ score, enabled: [...enabled], mono });
  }
  async function share() {
    const url = shareUrl(location.origin, location.pathname, {
      view: "eic",
      piece: pieceId,
      step,
      layers: [...enabled].join(","),
      mono,
    });
    setShared(url);
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace de esta selección copiado.");
    } catch {
      setMessage("Copia el enlace que aparece debajo de los controles.");
    }
  }
  useEffect(() => {
    if (!score || playing) return;
    history.replaceState(
      null,
      "",
      shareUrl(location.origin, location.pathname, {
        view: "eic",
        piece: pieceId,
        step,
        layers: [...enabled].join(","),
        mono,
      }),
    );
  }, [score, playing, pieceId, step, enabled, mono]);
  const active = score?.steps[step];
  return (
    <section
      className="eic-view jukebox-view"
      aria-labelledby="jukebox-title"
      aria-busy={!score && !error}
    >
      <div className="section-kicker">
        <span className="small-orb" />
        EARTH INFORMATION JUKEBOX · IMAGEN → SONIDO
      </div>
      <div className="eic-title">
        <h1 id="jukebox-title">
          Mira una imagen.
          <br />
          <em>Descubre cómo suena.</em>
        </h1>
        <p>
          Explora tres lecturas de un mismo frame real de NASA.
          <br />
          GEOS Aerosols · 19 agosto 2025 · 20:00 UTC
        </p>
      </div>
      <details className="listening-guide">
        <summary>
          <Icon name="headphones" size={17} />
          Empieza sin depender de la vista
        </summary>
        <p>
          1. Elige una lectura. 2. Pulsa reproducir. 3. Activa una voz para
          reconocerla. 4. Pausa y usa las flechas del deslizador para
          inspeccionar un segmento.
        </p>
        <p>
          El color elige el timbre; su presencia visual, la intensidad relativa;
          la altura en la imagen, el tono; el barrido, el tiempo y el estéreo.
          La tabla describe los mismos rasgos. Puedes activar mono si no usas
          dos canales.
        </p>
        <p>
          El sonido representa colores del render de un modelo. No mide
          concentración, contaminación respirada ni causa de un incendio.
        </p>
      </details>
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button
            className="secondary-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Reintentar EIC
          </button>
        </div>
      )}
      <div
        className="piece-list"
        role="group"
        aria-label="Lecturas de la imagen EIC"
      >
        {catalog?.pieces.map((p) => (
          <button
            key={p.id}
            className={p.id === pieceId ? "selected" : ""}
            aria-pressed={p.id === pieceId}
            onClick={() => choose(p.id)}
          >
            <span>{p.crop ? "ENCUADRE" : "IMAGEN GLOBAL"}</span>
            <strong>{p.title}</strong>
            <small>{p.question}</small>
          </button>
        ))}
      </div>
      {piece && (
        <>
          <p className="piece-description">{piece.description}</p>
          <div className="eic-image-tools">
            <button
              className="secondary-button"
              aria-pressed={mask}
              onClick={() => setMask((v) => !v)}
            >
              <Icon name="eye" size={15} />
              {mask ? "Ver imagen original" : "Ver píxeles seleccionados"}
            </button>
            <span>
              El encuadre y las cuatro voces son rasgos visuales; sin
              georreferenciación exacta.
            </span>
          </div>
          <div className={`eic-frame ${piece.crop ? "cropped" : ""}`}>
            <img
              src={mask ? piece.mask : piece.image}
              alt={
                mask
                  ? `Máscaras de colores seleccionados para ${piece.title}. No representan concentraciones.`
                  : `${piece.title}. Visualización GEOS de aerosoles del 19 de agosto de 2025. ${piece.description}`
              }
            />
            <div
              className="scan-line"
              style={{ left: `${(active?.x ?? 0) * 100}%` }}
              aria-hidden="true"
            />
            <span className="frame-tag">
              {mask ? "MÁSCARAS HSV · EXTRACTOR V2" : "NASA GMAO / SVS 5669"}
            </span>
          </div>
        </>
      )}
      <div className="eic-transport">
        <button
          className="play-button"
          disabled={!score || enabled.size === 0}
          onClick={toggle}
          aria-label={
            playing ? "Pausar sonificación EIC" : "Reproducir sonificación EIC"
          }
          aria-pressed={playing}
        >
          <Icon name={playing ? "pause" : "play"} size={19} />
        </button>
        <input
          type="range"
          min="0"
          max={(score?.steps.length ?? 1) - 1}
          value={step}
          onChange={(e) => seek(+e.target.value)}
          aria-label="Segmento de la imagen EIC"
          aria-valuetext={`Segmento ${step + 1} de ${score?.steps.length ?? 0}, ${(step * 0.25).toFixed(2)} segundos`}
        />
        <span className="mono">
          {(step * 0.25).toFixed(1)} /{" "}
          {((score?.steps.length ?? 0) * 0.25).toFixed(0)} s
        </span>
        <label className="eic-volume">
          <Icon name="volume" size={17} />
          <input
            aria-label="Volumen del estudio EIC"
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
      </div>
      <div className="eic-layers">
        {EIC_LAYERS.map((l) => (
          <button
            key={l.id}
            className={enabled.has(l.id) ? "enabled" : ""}
            aria-pressed={enabled.has(l.id)}
            onClick={() =>
              setEnabled((old) => {
                const n = new Set(old);
                if (n.has(l.id)) n.delete(l.id);
                else n.add(l.id);
                return n;
              })
            }
          >
            <span className="layer-dot" style={{ background: l.color }} />
            <span>
              <strong>{l.name}</strong>
              <small>
                {l.instrument} · {l.detail}
              </small>
            </span>
            <Icon name={enabled.has(l.id) ? "check" : "plus"} size={15} />
          </button>
        ))}
      </div>
      <p role="status" className="playback-status">
        {!score
          ? error
            ? "Pieza no disponible. Revisa el aviso y reintenta."
            : "Preparando los rasgos y la partitura de la imagen…"
          : enabled.size === 0
            ? "Todas las voces están desactivadas. Activa una para escuchar."
            : playing
              ? "Sonificación en curso; el reloj del audio guía el barrido."
              : "Audio pausado. El deslizador permite inspeccionar cada segmento."}{" "}
        {message}
      </p>
      <div className="eic-actions">
        <button className="secondary-button" disabled={!score} onClick={read}>
          <Icon name="volume" size={16} />
          Leer segmento
        </button>
        <button
          className="secondary-button"
          disabled={!score || exporting || !enabled.size}
          onClick={exportWav}
        >
          <Icon name="download" size={16} />
          {exporting ? "Generando WAV…" : "Exportar WAV"}
        </button>
        <button
          className="secondary-button"
          disabled={!score}
          onClick={() =>
            downloadFile(
              JSON.stringify(
                {
                  source: catalog?.source,
                  piece,
                  enabled: [...enabled],
                  mono,
                  algorithm: score?.meta,
                },
                null,
                2,
              ),
              `terraecho-${pieceId}-source.json`,
              "application/json",
            )
          }
        >
          <Icon name="download" size={16} />
          Ficha de fuente
        </button>
        <button className="secondary-button" onClick={share}>
          <Icon name="external" size={16} />
          Compartir selección
        </button>
      </div>
      {shared && (
        <label className="share-field">
          Enlace reproducible
          <input
            readOnly
            value={shared}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
      <div className="ab-controls" aria-label="Comparación de selecciones">
        <span>Compara sin cambiar la gramática sonora</span>
        {(["A", "B"] as const).map((k) => (
          <div key={k}>
            <button onClick={() => save(k)} disabled={!score}>
              Guardar {k}
            </button>
            <button disabled={!saved[k]} onClick={() => load(k)}>
              Cargar {k}
            </button>
          </div>
        ))}
        <small>
          A/B conserva pieza, segmento y voces en esta sesión; no son resultados
          de un experimento con personas.
        </small>
      </div>
      <details className="feature-details" open>
        <summary>¿Qué produce el sonido del segmento {step + 1}?</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Rasgos del segmento EIC"
        >
          <table>
            <caption>
              Rasgos visuales extraídos; las ganancias son relativas a cada capa
              y encuadre.
            </caption>
            <thead>
              <tr>
                <th scope="col">Capa / timbre</th>
                <th scope="col">Píxeles seleccionados</th>
                <th scope="col">Altura visual</th>
                <th scope="col">Nota</th>
                <th scope="col">Ganancia relativa</th>
              </tr>
            </thead>
            <tbody>
              {EIC_LAYERS.map((l) => {
                const v = active?.layers[l.id];
                return (
                  <tr key={l.id}>
                    <th scope="row">
                      {l.name}
                      <small>
                        {enabled.has(l.id) ? "Activa" : "Silenciada"}
                      </small>
                    </th>
                    <td>{v ? `${(v.presence * 100).toFixed(1)} %` : "—"}</td>
                    <td>{v ? `${Math.round(v.height * 100)} %` : "—"}</td>
                    <td>
                      {v
                        ? `${midiName(v.midi)} · ${midiHz(v.midi).toFixed(0)} Hz`
                        : "—"}
                    </td>
                    <td>{v ? `${Math.round(v.gain * 100)} %` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          La altura es una coordenada de la imagen, no una latitud recuperada.
          Una capa con más ganancia no implica mayor concentración que otra. Los
          colores de fondo y las capas superpuestas pueden introducir confusión.
        </p>
      </details>
      <details className="source-details">
        <summary>Fuente, algoritmo y límites de esta pieza</summary>
        <p>{catalog?.source.credit}</p>
        <p>
          Frame: {catalog?.source.observedAt}. Publicación NASA:{" "}
          {catalog?.source.publishedAt}. Extractor: {score?.meta.schema_version}
          , reglas HSV por capa y normalización al percentil 98 dentro del
          encuadre.
        </p>
        <p>
          La fecha original de descarga del activo del equipo no está
          registrada. La huella permite identificar el archivo usado.
        </p>
        {catalog?.source.verifiedReacquisition && (
          <p>
            Nueva adquisición verificada desde NASA: {catalog.source.verifiedReacquisition.retrievedAt}.
            Coincide byte a byte con el frame usado por las tres lecturas; esta fecha no reemplaza la descarga original desconocida.
          </p>
        )}
        <code>SHA-256 {catalog?.source.sha256}</code>
        <p>
          Este frame global de 2025 no demuestra humo causado por las semanas
          FIRMS de Perú en 2026. La clasificación de colores es una lectura de
          la visualización, no una medición atmosférica.
        </p>
        <a
          href="https://svs.gsfc.nasa.gov/5669/"
          target="_blank"
          rel="noreferrer"
        >
          Abrir fuente NASA SVS 5669 <Icon name="external" size={14} />
        </a>
        <a
          href="https://svs.gsfc.nasa.gov/13786/"
          target="_blank"
          rel="noreferrer"
        >
          Antecedente: Caldwell 73 · SYSTEM Sounds / NASA
        </a>
      </details>
    </section>
  );
}
