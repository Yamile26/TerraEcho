"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
export type DialogKind = "method" | "sources" | "accessibility";
export function InfoDialog({
  kind,
  onClose,
}: {
  kind: DialogKind;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [api, setApi] = useState(""),
    [checking, setChecking] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener("cancel", cancel);
    return () => {
      d?.removeEventListener("cancel", cancel);
      if (d?.open) d.close();
    };
  }, [onClose]);
  async function checkApi() {
    setChecking(true);
    try {
      const r = await fetch("/api/fires?mode=live&days=1");
      const d = await r.json();
      setApi(
        r.ok
          ? `Conexión correcta: ${d.observations.length} detecciones en la ventana consultada. Estos datos recientes no sustituyen la serie semanal ni tienen anomalía calculada.`
          : (d.error?.message ?? "No fue posible conectar con FIRMS."),
      );
    } catch {
      setApi(
        "La conexión no está disponible. El archivo del equipo sigue accesible.",
      );
    } finally {
      setChecking(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="info-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <span className="micro">
          TERRAECHO /{" "}
          {kind === "method"
            ? "CIENCIA ABIERTA"
            : kind === "sources"
              ? "TRAZABILIDAD"
              : "EXPLORACIÓN ACCESIBLE"}
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <Icon name="cross" />
        </button>
      </div>
      {kind === "method" ? (
        <>
          <h2>
            Del dato a la emoción.
            <br />
            <em>Sin perder la ciencia.</em>
          </h2>
          <p>
            El pipeline compara el número semanal de focos de calor en celdas de
            0.5° con la misma época de otros años. Una anomalía robusta basada
            en mediana y MAD distingue actividad habitual de actividad inusual.
          </p>
          <div className="mapping-list">
            {[
              [
                "Anomalía z",
                "Disonancia",
                "z ≤ 1: consonante. z ≥ 4: máxima disonancia.",
              ],
              [
                "Latitud",
                "Altura tonal",
                "Sur: grave. Norte: agudo. Escala pentatónica.",
              ],
              [
                "FRP acumulada",
                "Intensidad sonora",
                "Escala logarítmica de potencia radiativa.",
              ],
              ["Cantidad de focos", "Ritmo", "Entre 1 y 4 pulsos por semana."],
              [
                "Longitud",
                "Posición estéreo",
                "Oeste a la izquierda. Este a la derecha.",
              ],
            ].map(([a, b, c]) => (
              <div key={a}>
                <span>{a}</span>
                <Icon name="arrow" size={15} />
                <strong>{b}</strong>
                <small>{c}</small>
              </div>
            ))}
          </div>
          <p className="dialog-note">
            La vista web sintetiza hasta las 18 celdas de mayor FRP de la
            selección. La tabla y el CSV conservan los agregados de todas las
            celdas. “Habitual” describe el comportamiento estadístico; no
            certifica la salud del bosque.
          </p>
        </>
      ) : kind === "sources" ? (
        <>
          <h2>
            Una señal que
            <br />
            <em>puedes rastrear.</em>
          </h2>
          <div className="source-block">
            <span className="outline-tag">01 / OBSERVACIONES</span>
            <h3>NASA FIRMS · VIIRS Suomi NPP</h3>
            <p>
              Se muestran los JSON existentes del pipeline del equipo: 52
              semanas de 2025 y 44 de 2026, hasta la semana del 29 de octubre.
              2026 es provisional. El agregado general cubre la caja geográfica
              del pipeline y puede incluir detecciones fuera del territorio
              peruano; no equivale a la suma de departamentos. La base de
              comparación incluye años desde 2012; no todos están exportados
              como pistas navegables.
            </p>
            <a
              href="https://firms.modaps.eosdis.nasa.gov/"
              target="_blank"
              rel="noreferrer"
            >
              Abrir NASA FIRMS <Icon name="external" size={13} />
            </a>
          </div>
          <div className="source-block">
            <span className="outline-tag">02 / VISUALIZACIÓN EIC</span>
            <h3>GEOS Aerosols · NASA SVS 5669</h3>
            <p>
              Frame del 19 de agosto de 2025 a las 20:00 UTC. El barrido y la
              síntesis utilizan la partitura generada por el módulo Python del
              repositorio.
            </p>
            <a
              href="https://svs.gsfc.nasa.gov/5669/"
              target="_blank"
              rel="noreferrer"
            >
              Abrir la fuente EIC <Icon name="external" size={13} />
            </a>
          </div>
          <div className="source-block">
            <h3>Conexión con FIRMS</h3>
            <p>
              El archivo funciona sin credenciales. Para consultar detecciones
              recientes, configura FIRMS_MAP_KEY únicamente en el servidor. La
              API consulta un rectángulo que contiene Perú; puede incluir zonas
              vecinas.
            </p>
            <button
              className="secondary-button"
              onClick={checkApi}
              disabled={checking}
            >
              {checking ? "Comprobando…" : "Comprobar conexión API"}
              <Icon name="satellite" size={16} />
            </button>
            {api && (
              <p role="status" className="api-result">
                {api}
              </p>
            )}
          </div>
          <p className="dialog-note">
            Los focos térmicos no equivalen a incendios individuales ni a
            hectáreas quemadas. Las órbitas y ondas son ilustrativas. Esta
            herramienta es educativa y no sustituye sistemas oficiales de
            emergencia. Los archivos originales se conservan en el repositorio;
            no se auditaron aquí las descargas históricas.
          </p>
        </>
      ) : (
        <>
          <h2>
            Más formas
            <br />
            <em>de explorar.</em>
          </h2>
          <p>
            El sonido complementa los datos. Puedes recorrer la misma
            información con teclado, mapa 2D, tabla y descripción hablada.
          </p>
          <ul className="access-list">
            <li>
              <kbd>Tab</kbd>
              <span>
                Recorrer botones y controles; el foco siempre es visible.
              </span>
            </li>
            <li>
              <kbd>← →</kbd>
              <span>Cambiar la semana al enfocar el deslizador temporal.</span>
            </li>
            <li>
              <kbd>Esc</kbd>
              <span>Cerrar esta ventana y volver al control anterior.</span>
            </li>
          </ul>
          <h3>Escucha con contexto</h3>
          <p>
            “Leer selección” usa la voz del navegador para anunciar región,
            fecha, focos y anomalía. Puedes detenerla con el mismo botón. Los
            huecos de datos permanecen en silencio y se anuncian como
            información insuficiente.
          </p>
          <h3>Movimiento y dispositivos</h3>
          <p>
            Pausa la rotación con el control del globo. Se respeta la
            preferencia de movimiento reducido del sistema. Si WebGL no está
            disponible, cambia al mapa 2D; todos los datos permanecen en el
            observatorio.
          </p>
          <p className="dialog-note">
            La inclusión debe comprobarse con usuarios y tecnologías de
            asistencia. Estas funciones son una base de accesibilidad; no
            constituyen una certificación WCAG.
          </p>
        </>
      )}
      <div className="dialog-bottom">
        <span>ASTRACOM · NASA SPACE APPS 2026</span>
        <button className="text-button" onClick={onClose}>
          Volver a explorar
          <Icon name="arrow" size={15} />
        </button>
      </div>
    </dialog>
  );
}
