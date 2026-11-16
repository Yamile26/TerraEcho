# Contratos de datos y API

## Archivo

`GET /api/fires?year=2025` devuelve `FireScore` validado en ejecución. Catálogo en `/data/catalog.json`: 2012–2025 reconstruidos, 2026 heredado. Años fuera de 2012–2026: 400; archivo ausente: 404; JSON incompatible: 502. El proveedor es snapshot local o el servicio configurado por `TERRAECHO_PYTHON_API_URL`, que debe implementar `GET /v1/scores/{year}`. Ese servicio HTTP no está incluido ni es necesario: Python ya procesa lotes reproducibles.

| Campo | Semántica |
| --- | --- |
| `meta.schema_version` | `2.0.0` para reconstruidos; ausente en legado |
| `meta.geographic_scope` | `peru-admin1-point-clipped`; legado usa caja geográfica |
| `meta.baseline_years` | Años de referencia efectivos; objetivo excluido, nunca 2026 en reconstruidos |
| `meta.provenance` | Huellas de algoritmo, geometría y manifiesto; versiones científicas |
| `weeks[].week` | Índice 0–51 desde 1 de enero, no semana ISO |
| `start_date`, `end_date` | Bin de 7 días, último de 8/9 |
| `data_gap` | No interpretar anomalía; `z:null`, celdas vacías y silencio |
| `country`, `regions` | Conteos del mismo conjunto de puntos territoriales en esquema 2 |
| `frp` | Suma de registros conocidos, MW; `null` si hay detecciones y ninguna FRP conocida |
| `frp_unknown_count` | Registros con FRP desconocida; no convierten esa ausencia en cero observado |
| `cells[].region` | Asignación territorial antes de agregar; coordenada representativa, no incendio exacto |

La demo estática obtiene el mismo JSON desde `/data/terraecho_YEAR.json`, sin ejecutar API. El CSV conserva valores desconocidos vacíos.

## Observaciones recientes

`GET /api/fires?mode=live&source=VIIRS_NOAA20_NRT&days=3`. Fuente predeterminada NOAA-20; lista cerrada NOAA-20, NOAA-21, SNPP. `days`: entero 1–5; `date=YYYY-MM-DD` opcional establece inicio UTC. Se consulta disponibilidad por producto y se rechaza una ventana completamente fuera del rango conocido. SNPP termina 2026-11-02; no se cambia de sensor silenciosamente.

Respuesta: `meta` con proveedor, producto, fechas inicio/fin, `retrievedAt`, `availability`, caja de adquisición, ámbito territorial, filas originales y excluidas, FRP desconocida, `anomalyComputed:false`; `observations[]` con latitud, longitud, `frp:number|null`, fecha UTC, confianza, satélite y departamento. No se homologa este NRT multiopción con el baseline SP para calcular z. Es exploración descriptiva separada.

| HTTP | Código | Acción |
| --- | --- | --- |
| 400 | `INVALID_MODE`, `INVALID_YEAR`, `INVALID_QUERY` | Corregir entrada |
| 404 | `DATA_NOT_EXPORTED` | Consultar catálogo |
| 422 | `PRODUCT_OUTSIDE_COVERAGE` | Elegir producto/fecha dentro del intervalo |
| 429 | `UPSTREAM_RATE_LIMIT` | Respetar espera/presupuesto por proceso |
| 502 | `SCORE_UNAVAILABLE`, `FIRMS_UNAVAILABLE` | Fallo visible, sin sustituir observaciones |
| 503 | `FIRMS_NOT_CONFIGURED` | Configurar clave solo en servidor y reiniciar |

Timeout de consulta 15 s, disponibilidad 5 s, CSV máximo 8 MB; caché 2 min, deduplicación de solicitudes concurrentes y máximo 10 consultas de datos nuevas/minuto/proceso. Cada consulta puede además consultar disponibilidad. No es una cuota global multiinstancia. Errores y respuestas no devuelven URL con clave. El código de aplicación no la registra. Para tráfico distribuido, medir primero y configurar límite compartido antes de prometer una cuota global.

`GET /api/health` indica presencia de clave/proveedor; no valida la clave ni implica éxito NASA. Una respuesta 200 vacía no certifica cobertura ni ausencia de fuego.

## EIC

`/eic/pieces/catalog.json` describe tres lecturas de una sola imagen; `/eic/pieces/aerosols-*.json` contiene esquema `2.0.0`, huella de imagen, ID, fecha, recorte y 104 pasos. Cada paso tiene x/pan y cuatro capas con presencia, altura visual, nota MIDI, ganancia, peso y normalizador. Se validan rangos finitos, orden, timbres, IDs y rutas permitidas, y correspondencia de imagen/pieza. La máscara es lectura de colores, no concentración ni verdad atmosférica.
