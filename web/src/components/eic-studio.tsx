"use client";
import { useEffect, useRef, useState } from "react";
import { Sonifier } from "@/lib/audio";
import type { EicScore } from "@/lib/types";
import { Icon } from "./icon";
const LAYERS = [
  {
    id: "black_carbon",
    name: "Carbono negro",
    detail: "Capa de humo",
    color: "#f59a67",
  },
  {
    id: "dust",
    name: "Polvo",
    detail: "Partículas minerales",
    color: "#bd9be6",
  },
  {
    id: "sea_salt",
    name: "Sal marina",
    detail: "Aerosol oceánico",
    color: "#7fc7e2",
  },
  {
    id: "sulfate",
    name: "Sulfatos",
    detail: "Capa de aerosoles",
    color: "#a9dd9e",
  },
];
export function EicStudio() {
  const [score, setScore] = useState<EicScore | null>(null),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.35);
  const [enabled, setEnabled] = useState(new Set(LAYERS.map((l) => l.id)));
  const engine = useRef<Sonifier | null>(null);
  useEffect(() => {
    engine.current = new Sonifier();
    const c = new AbortController();
    fetch("/data/eic_aerosols.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la pista EIC.");
        return r.json();
      })
      .then((d) => {
        if (!Array.isArray(d.steps) || !d.steps.length)
          throw new Error("Pista EIC incompleta.");
        setScore(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => {
      c.abort();
      engine.current?.dispose();
    };
  }, []);
  useEffect(() => {
    engine.current?.volume(volume);
  }, [volume]);
  useEffect(() => {
    if (!playing || !score) return;
    engine.current?.eic(score, step, enabled);
    const id = setTimeout(() => {
      if (step >= score.steps.length - 1) {
        setPlaying(false);
        setStep(0);
      } else setStep((s) => s + 1);
    }, 250);
    return () => clearTimeout(id);
  }, [playing, score, step, enabled]);
  useEffect(() => {
    if (!playing) engine.current?.stop();
  }, [playing]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setPlaying(false);
        engine.current?.stop();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  async function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    try {
      await engine.current?.enable();
      engine.current?.volume(volume);
      setPlaying(true);
    } catch {
      setError(
        "Tu navegador no permitió iniciar el audio. Vuelve a pulsar reproducir.",
      );
    }
  }
  return (
    <section className="eic-view view-enter">
      <div className="section-kicker">
        <span className="small-orb" />
        EARTH INFORMATION CENTER · PISTA 02
      </div>
      <div className="eic-title">
        <h1>
          Una imagen.
          <br />
          <em>Cuatro voces.</em>
        </h1>
        <p>
          Recorre una visualización real de NASA EIC.
          <br />
          Cada color encuentra su propio instrumento.
        </p>
      </div>
      <div className="eic-frame">
        <img
          src="/eic/aerosols.png"
          alt="Visualización global GEOS de aerosoles del 19 de agosto de 2025: carbono negro, polvo, sal marina y sulfatos."
        />
        <div
          className="scan-line"
          style={{ left: `${(score?.steps[step]?.x ?? 0) * 100}%` }}
        />
        <span className="frame-tag">
          GEOS AEROSOLS / 19 AGO 2025 · 20:00 UTC
        </span>
      </div>
      <div className="eic-transport">
        <button
          className="play-button"
          disabled={!score}
          onClick={toggle}
          aria-label={
            playing ? "Pausar sonificación EIC" : "Reproducir sonificación EIC"
          }
        >
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <input
          type="range"
          min="0"
          max={(score?.steps.length ?? 1) - 1}
          value={step}
          onChange={(e) => {
            engine.current?.stop();
            setStep(+e.target.value);
          }}
          aria-label="Posición del barrido de la imagen EIC"
        />
        <span className="mono">
          {(step * 0.25).toFixed(1)} /{" "}
          {((score?.steps.length ?? 0) * 0.25).toFixed(0)} s
        </span>
        <label className="eic-volume">
          <Icon name="volume" size={16} />
          <input
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
            aria-label="Volumen del estudio EIC"
          />
        </label>
      </div>
      <div className="eic-layers">
        {LAYERS.map((l) => (
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
              <small>{l.detail}</small>
            </span>
            <Icon name={enabled.has(l.id) ? "check" : "plus"} size={15} />
          </button>
        ))}
      </div>
      <p className="eic-caption">
        La posición del barrido controla tiempo y estéreo; la altura, el tono;
        la presencia del color, el volumen. Se sonifica la imagen: estos valores{" "}
        <strong>no son concentraciones atmosféricas</strong>.
      </p>
      <a
        className="source-link"
        href="https://svs.gsfc.nasa.gov/5669/"
        target="_blank"
        rel="noreferrer"
      >
        Fuente: NASA Scientific Visualization Studio · GEOS Aerosols
        <Icon name="external" size={13} />
      </a>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
