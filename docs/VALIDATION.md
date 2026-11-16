# Evidencia de validación de la entrega

Este documento conserva comprobaciones históricas de la entrega. El estado vigente está en el [registro de 53 tareas](ESTADO_53_TAREAS.md). La corrección del tema azul marino/turquesa se registra en `evaluation/theme-restoration-check.json`; las capturas históricas conservan su contexto original.

| Comprobación | Resultado real |
| --- | --- |
| `python -m unittest discover -s tests -p 'test_science.py' -v` | 8 pruebas pasan: puntos/fronteras/huecos, FRP desconocida, leyenda/crop y reconciliación/huellas de los14 snapshots |
| `python tests/test_pipeline.py` | Pruebas originales pasan, con avisos previstos de fixtures; no convierten el pipeline heredado en generador nuevo |
| `npm run test:web` | 21 pruebas pasan: contratos, errores API, selección, geografía, cobertura, EIC, reloj y WAV |
| `npm run typecheck` | Pasa |
| `npm run build` | Build Next.js de producción pasa, con `/api/fires` y `/api/health` dinámicos |
| `node web/scripts/build-archive-demo.mjs` | Build estático EIC/archivo pasa; excluye deliberadamente API y tests de servidor en copia temporal |
| `python scripts/evaluate_release.py` | Ejecutado sobre fuentes reales:9 configuraciones nacionales,3 resoluciones con anomalía por celda, representación de18 voces y caso peruano |
| `node --import tsx web/scripts/export-reference.mts` | 3 WAV originales, 22,050 Hz estéreo,25.998 s, cero muestras saturadas; fichas con hash |
| WAV descargado desde la interfaz | Sudamérica: hash `0de986f71ca57eaa98ad59bd14e4e76cef8ecc7134c2aab2c76908b656901869`, mismo archivo que CLI, fuente/configuración RIFF incluidas |
| `summarize_pilot.py` con plantilla vacía | Rechaza explícitamente resultados inexistentes; no hay participantes simulados |

## Navegador real de revisión

Se comprobaron: entrada EIC, tres lecturas, aislamiento/máscaras, transporte por reloj de audio, pausa, A/B, exportación WAV, compartir y recargar pieza/segmento/mono; archivo2012/2025; gap inicial2012; tabla de todas las celdas, apertura/escucha/parada con Enter; cierre de diálogo con Escape y retorno real de foco. El modo reciente mostró el error de clave ausente sin bloquear EIC/archivo. No había MAP_KEY del equipo en este entorno.

Axe-core4.14.0, reglas WCAG2A/AA,2.1A/AA y2.2AA: cero infracciones detectadas en EIC, explorador y reciente en iframe390 CSS px. Se guardaron informes; algunos items requieren revisión manual (`incomplete`: contraste sobre imagen, atributos o tamaño de objetivo según vista). En explorador y EIC el documento midió380px de viewport y380px de contenido, reservándose el scrollbar del iframe. Esto prueba esa anchura, no todos los zoom/dispositivos ni conformidad WCAG integral.

Las capturas `docs/screenshots/terraecho-release-*.jpg` documentan la revisión histórica con paleta verde, posteriormente corregida porque no correspondía a la referencia de la usuaria. La paleta vigente usa fondo `#040810`, paneles `#0A1623` y acento turquesa `#53E7DE`; ver [THEME.md](THEME.md). El navegador no ofrece WebGL acelerado: se ejercitó la esfera compatible. La corrección de raycast/oclusión necesita comprobación GPU real; no se atribuye una prueba acelerada a esas capturas.

## Hallazgos científicos que limitan la interpretación

Los713 bins nacionales finitos pasan de2 a28 clasificados críticos según combinación probada; el valor de entrega produce15. Variar resolución cambia las etiquetas críticas asignadas a los mismos registros. No se calibró para maximizar coincidencia con un caso conocido y no se estima precisión de eventos.

En713 bins no vacíos, la mezcla de18 voces representa una mediana del48.6% del conteo y62.3% de FRP conocida. Omite celdas con z≥2.5 y conteo≥5 en341 bins; por eso se muestra la pérdida y se ofrece cada celda. El audio resumido no es un detector completo.

Caso16–22sep2024: Amazonas83 detecciones/z2.53, San Martín512/z1.53, Ucayali2361/z3.02. [INDECI,18sep2024](https://www.gob.pe/institucion/indeci/noticias/1024642-jefe-del-indeci-destaca-declaratoria-de-estado-de-emergencia-en-zonas-mas-afectadas-por-incendios-forestales) incluye esas regiones en la emergencia. La ventana satelital también contiene días posteriores al comunicado. Es contexto retrospectivo y ámbitos administrativos compatibles, no equivalencia entre detecciones e incendios ni validación de exactitud.

Se verificaron fuentes públicas FIRMS y hashes reales. El frame EIC heredado está identificado por hash, pero un nuevo intento de obtener sus bytes oficiales devolvió503; el intento está registrado. La fecha original de descarga permanece desconocida.

## Verificación pública

La demo HTTPS fue abierta sin login, cargó el archivo2025 y los activos EIC, completó una reproducción y descargó un WAV idéntico a la referencia CLI. La sección reciente indica correctamente que esa edición no tiene API. Evidencia: `public-demo-check.json`; CI remoto43793695690 exitoso. Captura adicional: `terraecho-public-eic.jpg`.

## Evidencia aún necesaria

Continuación F01: el comprobador de conexión ahora rechaza HTTP 200 con JSON incompleto, snapshot, producto distinto, fechas/ámbito incorrectos, conteos incompatibles, FRP u observaciones inválidas. Conserva los ceros válidos y la disponibilidad desconocida sin afirmar cobertura total. Solo escribe campos permitidos y códigos de error conocidos. Ocho pruebas nuevas con fixtures sintéticos verifican estos casos, respuestas HTML, fallos de red y rechazo de orígenes con credenciales antes de consultar. `npm run test:web`: **29 pruebas pasan**; `npm run typecheck`: pasa. Estos fixtures no se guardan como evidencia de una consulta NASA real. F01 sigue parcial hasta ejecutar el comando en el servidor del equipo con su clave local.

Participantes reales ciegos/baja visión, comprensión y confort, lectores/voz/zoom/tacto en equipos reales, evaluación independiente de máscaras, sincronización GPU+audio, nueva consulta NASA con la clave del equipo, hosting completo con secreto, licencia aprobada y envío oficial. El [protocolo](evaluation/PROTOCOL.md) y los comprobadores están preparados. No se presentan fixtures ni ausencia de resultados como evidencia positiva.

## Restauración de la referencia azul marino y turquesa

Se restauran los tokens del commit `da3a282` y se eliminan los tres colores verdes independientes de los controles desactivados. Las cuatro vistas de escritorio muestran fondo `#040810`, panel `#0A1623` y acento `#53E7DE`, sin desbordamiento horizontal en la anchura revisada. En iframe de 390 CSS px, el documento interior midió 380 px de viewport y contenido. Axe 4.14.0 no detectó infracciones en EIC, archivo y reciente; EIC conserva dos categorías `incomplete` y archivo dos, que requieren revisión manual.

Las 38 pruebas web, tipos y build Worker pasan. Los datos y archivos científicos no se modifican. La fuente visual aportada queda versionada en `docs/design/terraecho-reference-navy-cyan.png`; la evidencia y sus límites están en `evaluation/theme-restoration-check.json`. Las capturas `terraecho-navy-cyan-*.jpg` representan esta corrección.
