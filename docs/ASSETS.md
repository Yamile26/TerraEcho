# Fuentes, activos y autoría

| Activo | Procedencia, función y límites |
| --- | --- |
| Imagen EIC original | NASA GMAO / Scientific Visualization Studio, [GEOS Aerosols, SVS 5669](https://svs.gsfc.nasa.gov/5669/), Joseph V. Ardizzone, Helen-Nicole Kostis; asesoría Lesley Ott. Frame 2025-08-19 20:00 UTC, GEOS-FP 2 km Replay, publicación 2026-08-10. Huella y fuentes en `data/manifests/eic-source.json`. Fecha original de descarga desconocida. Nueva adquisición del frame verificada byte a byte: 2026-11-16 03:58:08.014 UTC, registrada por separado en `eic-reacquisition-check.json`. |
| Máscaras, crop y partituras | Derivados de ese mismo activo mediante reglas HSV de TerraEcho. Tres lecturas, no tres fechas/datasets. No son concentraciones ni clasificación atmosférica validada. |
| Audio | Síntesis original de parámetros TerraEcho. No se extrae música ni pista sonora de vídeos NASA. Inspiración: [Caldwell 73, SVS 13786](https://svs.gsfc.nasa.gov/13786/), NASA/CXC/SYSTEM Sounds (M. Russo, A. Santaguida). Su radar rotatorio no es nuestro barrido lineal: se reconoce la adaptación, no se atribuye el concepto original. |
| FIRMS 2012–2025 | NASA FIRMS VIIRS Suomi NPP 375 m, Collection 2, Standard Processing. URL, UTC de adquisición, hash, filas y cobertura en manifiestos; datos crudos descargables, no versionados. |
| Legado 2026 | Exportado previo del equipo; raw no disponible aquí. Caja geográfica y huecos heurísticos, sin revalidar. |
| Límites | Archivo previo geoBoundaries Perú ADM1 simplificado, [geoBoundaries](https://www.geoboundaries.org/). Se utiliza por punto original en el pipeline nuevo. Confirmar edición/licencia específica del archivo original antes de la entrega final. |
| Textura Tierra | [Activo de ejemplos oficiales Three.js](https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg), contexto visual. No es observación satelital actual. Confirmar condiciones de este activo específicas antes de redistribución final. |
| Iconos | SVG locales de la interfaz, sin CDN de iconos. |
| Tipografía | DM Sans / Manrope, Google Fonts opcional; fuentes del sistema de respaldo. Revisar avisos de tipografía al incorporar binarios; este repo usa CSS remoto. |
| Código | Trabajo del equipo más implementación asistida por IA. Historial Git distingue cambios; no implica que NASA haya creado o avalado el software. |

Ondas y satélites son ilustrativos: no se calculan efemérides ni propagación medida. No es un producto oficial NASA ni un sistema operativo de alertas.

La licencia del código y las condiciones de los activos son decisiones separadas. Ver `LICENSE_PROPOSAL.md`; no existe aprobación documentada de todos los autores para relicenciar aportes previos. Conservar créditos y revisar condiciones, sin asumir que cualquier material NASA o textura de un ejemplo es de libre uso para cualquier propósito.
