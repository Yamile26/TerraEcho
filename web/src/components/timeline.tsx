"use client";
import {
  dateLabel,
  LEVEL_COLOR,
  LEVEL_LABEL,
  number,
  selectedMetrics,
} from "@/lib/data";
import type { FireScore } from "@/lib/types";
import { Icon } from "./icon";
import type { DatasetCatalog } from "@/hooks/use-dataset";
interface Props {
  catalog: DatasetCatalog | null;
  score: FireScore;
  index: number;
  region: string;
  onChange: (n: number) => void;
  playing: boolean;
  onPlay: () => void;
  year: number;
  onYear: (n: number) => void;
  onExport: () => void;
}
export function Timeline({
  catalog,
  score,
  index,
  region,
  onChange,
  playing,
  onPlay,
  year,
  onYear,
  onExport,
}: Props) {
  const week = score.weeks[index];
  return (
    <section className="timeline" aria-label="Exploración temporal">
      <div className="timeline-heading">
        <div className="timeline-title">
          <span className="micro">LÍNEA DE TIEMPO</span>
          <span className="timeline-subtitle">
            Cada semana, una nueva señal.
          </span>
        </div>
        <div className="timeline-actions">
          <div
            className="year-switch"
            role="group"
            aria-label="Año del archivo"
          >
            <label>
              Año
              <select
                aria-label="Año del archivo"
                value={year}
                onChange={(e) => onYear(+e.target.value)}
              >
                {(
                  catalog?.entries ?? [
                    { year: 2025, quality: "reprocessed-source-archive" },
                    { year: 2026, quality: "legacy-unreproduced" },
                  ]
                ).map((e) => (
                  <option key={e.year} value={e.year}>
                    {e.year}
                    {e.quality === "legacy-unreproduced"
                      ? " · legado sin reproducir"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="icon-button export"
            title="Descargar serie CSV"
            aria-label="Descargar serie CSV"
            onClick={onExport}
          >
            <Icon name="download" size={17} />
          </button>
        </div>
      </div>
      <div className="timeline-controls">
        <button
          className={`play-button ${playing ? "is-playing" : ""}`}
          onClick={onPlay}
          aria-label={
            playing
              ? "Pausar recorrido temporal"
              : "Reproducir recorrido temporal con sonido"
          }
        >
          <Icon name={playing ? "pause" : "play"} size={19} />
        </button>
        <div className="timeline-track">
          <div className="week-bars">
            {Array.from({ length: 52 }, (_, i) => {
              const w = score.weeks[i],
                m = w ? selectedMetrics(w, region) : null;
              const max = Math.max(
                1,
                ...score.weeks.map(
                  (v) => selectedMetrics(v, region)?.count ?? 0,
                ),
              );
              return (
                <button
                  key={i}
                  tabIndex={-1}
                  aria-label={
                    w
                      ? `${dateLabel(w.start_date)}: ${number(m?.count ?? 0)} detecciones, ${m ? LEVEL_LABEL[m.level] : "sin datos"}`
                      : "Aún sin exportación"
                  }
                  disabled={!w}
                  className={`week-bar ${i === index ? "current" : ""} ${w?.data_gap ? "gap" : ""} ${!w ? "unavailable" : ""}`}
                  onClick={() => onChange(i)}
                  style={{
                    height: w
                      ? `${14 + Math.sqrt((m?.count ?? 0) / max) * 31}px`
                      : "10px",
                    backgroundColor: w?.data_gap
                      ? undefined
                      : m
                        ? LEVEL_COLOR[m.level]
                        : undefined,
                  }}
                  title={
                    w
                      ? `${dateLabel(w.start_date)}: ${number(m?.count ?? 0)} focos · ${m ? LEVEL_LABEL[m.level] : "sin datos"}`
                      : "Aún sin exportación"
                  }
                />
              );
            })}
          </div>
          <input
            className="timeline-range"
            type="range"
            min={0}
            max={score.weeks.length - 1}
            value={index}
            onChange={(e) => onChange(+e.target.value)}
            aria-label="Semana de observación"
            aria-valuetext={`${dateLabel(week.start_date, true)}, semana ${index + 1} de ${score.weeks.length}`}
          />
          <div className="month-labels">
            <span>ENE</span>
            <span>MAR</span>
            <span>MAY</span>
            <span>JUL</span>
            <span>SEP</span>
            <span>DIC</span>
          </div>
        </div>
        <div className="week-current">
          <span className="micro">
            SEMANA {String(index + 1).padStart(2, "0")}
          </span>
          <strong>{dateLabel(week.start_date)}</strong>
        </div>
      </div>
      <div className="timeline-note">
        <span>
          <span className="legend-square" />
          Hueco de datos <span className="legend-square outline" />
          Sin exportación
        </span>
        <span>
          Base histórica: {Math.min(...score.meta.baseline_years)}–
          {Math.max(...score.meta.baseline_years)} · {score.weeks.length}{" "}
          semanas disponibles
        </span>
      </div>
    </section>
  );
}
