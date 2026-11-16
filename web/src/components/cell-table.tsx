"use client";
import { useEffect, useState } from "react";
import type { CellVoice } from "@/lib/types";
import { number } from "@/lib/data";
export function CellTable({
  cells,
  onInspect,
  onListen,
  onStop,
}: {
  cells: CellVoice[];
  onInspect: (c: CellVoice | null) => void;
  onListen: (c: CellVoice) => Promise<void>;
  onStop: () => void;
}) {
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<CellVoice | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    setPage(0);
    setSelected(null);
  }, [cells]);
  return (
    <details className="feature-details cell-table">
      <summary>Explorar las {cells.length} celdas con teclado y datos</summary>
      <p>
        Posiciones representativas de celdas agregadas; no son ubicaciones
        exactas de incendios. Todas las celdas están disponibles aquí, aunque la
        mezcla use hasta 18 voces.
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Celdas del archivo"
      >
        <table>
          <caption>Página {page + 1}; hasta 20 celdas por página.</caption>
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Latitud / longitud</th>
              <th>Detecciones</th>
              <th>FRP sumada</th>
              <th>Anomalía z</th>
              <th>Explorar</th>
            </tr>
          </thead>
          <tbody>
            {cells.slice(page * 20, (page + 1) * 20).map((c, i) => (
              <tr key={`${page}-${i}`}>
                <th scope="row">{c.region ?? "Celda del archivo heredado"}</th>
                <td>
                  {c.lat.toFixed(3)} / {c.lon.toFixed(3)}
                </td>
                <td>{number(c.count)}</td>
                <td>{number(c.frp)} MW</td>
                <td>{c.z ?? "No calculada"}</td>
                <td>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSelected(c);
                      onInspect(c);
                    }}
                    aria-label={`Detalle de celda ${page * 20 + i + 1}, ${c.count} detecciones`}
                  >
                    Detalle
                  </button>
                  <button
                    className="secondary-button"
                    onClick={async () => {
                      await onListen(c);
                      setMessage(
                        `Detalle sonoro de celda ${page * 20 + i + 1}, ${c.count} detecciones. Reproducción de una sola celda.`,
                      );
                    }}
                    aria-label={`Escuchar celda ${page * 20 + i + 1}`}
                  >
                    Escuchar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <p role="status">
          Selección: {selected.region ?? "celda del archivo"}, {selected.count}{" "}
          detecciones; nota MIDI {selected.midi}, {selected.density} pulsos;
          ganancia relativa {Math.round(selected.gain * 100)} %. FRP
          desconocida: {selected.frp_unknown_count ?? 0} registros.
        </p>
      )}
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <button
          disabled={(page + 1) * 20 >= cells.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </button>
        <button
          onClick={() => {
            onStop();
            setMessage("Audio del detalle detenido.");
          }}
        >
          Detener detalle
        </button>
      </div>
      <p role="status">{message}</p>
    </details>
  );
}
