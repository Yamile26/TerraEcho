"use client";
import { useState } from "react";
import {
  dateLabel,
  LEVEL_COLOR,
  LEVEL_LABEL,
  number,
  selectedMetrics,
} from "@/lib/data";
import type { FireScore } from "@/lib/types";
import { Icon } from "./icon";
import { PALETTE } from "@/lib/theme";
export function Temporal({
  score,
  index,
  region,
  onChange,
}: {
  score: FireScore;
  index: number;
  region: string;
  onChange: (n: number) => void;
}) {
  const [table, setTable] = useState(false);
  const values = score.weeks.map((w) => selectedMetrics(w, region));
  const max = Math.max(1, ...values.map((v) => v?.count ?? 0)),
    valid = values.filter((v) => v && v.level !== "no_data");
  const critical = valid.filter((v) => v?.level === "critical").length;
  const peak = values.reduce(
    (best, v, i) => ((v?.count ?? 0) > (values[best]?.count ?? 0) ? i : best),
    0,
  );
  return (
    <section className="temporal-view view-enter">
      <div className="section-kicker">
        <span className="small-orb" />
        OBSERVATORIO TEMPORAL
      </div>
      <div className="temporal-header">
        <div>
          <h1>
            El fuego cambia.
            <br />
            <em>Su señal también.</em>
          </h1>
          <p>Escucha una semana. Descubre su lugar en la historia.</p>
        </div>
        <span className="outline-tag">
          {region === "Perú" ? "Área de estudio" : region} / {score.meta.year}
        </span>
      </div>
      <div className="chart-header">
        <span>Focos de calor por semana</span>
        <span className="micro">VIIRS · SUOMI NPP</span>
      </div>
      <div className="history-chart">
        <svg
          viewBox="0 0 860 225"
          role="img"
          aria-label={`Focos semanales de ${region} en ${score.meta.year}. Máximo ${number(max)}. La tabla accesible está debajo.`}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1="48"
                y1={188 - t * 160}
                x2="844"
                y2={188 - t * 160}
                stroke={PALETTE.line}
                strokeDasharray="3 5"
              />
              <text x="2" y={192 - t * 160} fill={PALETTE.muted} fontSize="11">
                {number(max * t)}
              </text>
            </g>
          ))}
          {score.weeks.map((w, i) => {
            const m = values[i],
              x = 57 + i * 15.1,
              h = ((m?.count ?? 0) / max) * 160;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={w.data_gap ? 28 : 188 - h}
                  width="10"
                  height={w.data_gap ? 160 : Math.max(2, h)}
                  rx="2"
                  fill={
                    w.data_gap
                      ? PALETTE.lineStrong
                      : LEVEL_COLOR[m?.level ?? "no_data"]
                  }
                  opacity={i === index ? 1 : 0.65}
                  onClick={() => onChange(i)}
                  style={{ cursor: "pointer" }}
                />
                <title>
                  {dateLabel(w.start_date)}: {m?.count} focos
                </title>
              </g>
            );
          })}
          <line
            x1={62 + index * 15.1}
            x2={62 + index * 15.1}
            y1="12"
            y2="195"
            stroke={PALETTE.accent}
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          {[0, 8, 17, 26, 35, 43, 51].map((i) => (
            <text
              key={i}
              x={57 + i * 15.1}
              y="218"
              fill={PALETTE.muted}
              fontSize="10"
            >
              {
                ["ENE", "MAR", "MAY", "JUL", "SEP", "NOV", "DIC"][
                  [0, 8, 17, 26, 35, 43, 51].indexOf(i)
                ]
              }
            </text>
          ))}
        </svg>
      </div>
      <div className="history-facts">
        <div>
          <span className="micro">PICO DE LA SERIE EXPORTADA</span>
          <strong>
            {number(values[peak]?.count ?? 0)} <small>focos</small>
          </strong>
          <span>{dateLabel(score.weeks[peak].start_date, true)}</span>
        </div>
        <div>
          <span className="micro">SEMANAS CRÍTICAS</span>
          <strong>
            {critical}
            <small> / {valid.length} válidas</small>
          </strong>
          <span>Anomalía z ≥ 2.5</span>
        </div>
        <div>
          <span className="micro">COBERTURA</span>
          <strong>
            {score.weeks.filter((w) => w.data_gap).length}
            <small> huecos</small>
          </strong>
          <span>No se interpretan como calma</span>
        </div>
      </div>
      <div className="table-toggle">
        <button
          className="text-button"
          onClick={() => setTable((v) => !v)}
          aria-expanded={table}
        >
          <Icon name="layers" size={16} />
          {table ? "Ocultar" : "Ver"} tabla accesible
          <Icon name="chevron" size={13} />
        </button>
        <span>Focos detectados ≠ incendios individuales</span>
      </div>
      {table && (
        <div className="table-scroll" tabIndex={0} aria-label="Datos semanales">
          <table>
            <caption className="sr-only">
              Serie semanal de {region}, {score.meta.year}
            </caption>
            <thead>
              <tr>
                <th>Semana del</th>
                <th>Focos</th>
                <th>FRP Σ (MW)</th>
                <th>Anomalía z</th>
                <th>Estado</th>
                <th>Explorar</th>
              </tr>
            </thead>
            <tbody>
              {score.weeks.map((w, i) => {
                const m = values[i];
                return (
                  <tr key={i} className={i === index ? "selected-row" : ""}>
                    <td>{dateLabel(w.start_date)}</td>
                    <td>{m ? number(m.count) : "—"}</td>
                    <td>{m ? number(m.frp) : "—"}</td>
                    <td>{m?.z?.toFixed(2) ?? "—"}</td>
                    <td>{LEVEL_LABEL[m?.level ?? "no_data"]}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => onChange(i)}
                      >
                        Semana {i + 1}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
