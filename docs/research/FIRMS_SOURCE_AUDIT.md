# Auditoría de fuentes FIRMS: Perú, Suomi-NPP

**Resultado del 16 de noviembre de 2026:** se recuperaron y validaron los 14 CSV públicos de 2012–2025, con **1,047,074 registros y 83,470,826 bytes**. No se usaron claves, cuentas, tokens, datos sintéticos ni elevación de permisos. El intento adicional de 2026 devolvió HTTP 404 y no produjo archivo de datos.

Los bytes originales permanecen en `data/raw/viirs-snpp_<año>_Peru.csv`, sin modificar. `.gitignore` excluye estos CSV; una copia nueva del repositorio debe recuperarlos de las URL del manifiesto. Los archivos versionables de esta auditoría son:

- `data/manifests/firms-downloads.json`: URL exacta, hora UTC real de cada recuperación, SHA-256, bytes, cabeceras HTTP, columnas, registros, fechas de detección, valores observados y controles de calidad.
- `data/manifests/firms-product-availability.json`: instantánea de metadatos públicos, índice del archivo por país y fechas de datos faltantes declaradas por NASA.

## Descarga y validación

La adquisición completa transcurrió entre `2026-11-16T01:21:56.268768+00:00` y `2026-11-16T01:22:28.478887+00:00`; el manifiesto conserva el momento individual de cada respuesta. El patrón exacto es:

```text
https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/{año}/viirs-snpp_{año}_Peru.csv
```

Se exigió una respuesta no vacía, CSV legible, esquema exacto de 15 columnas, número correcto de campos por fila, fechas dentro del año solicitado, coordenadas y números finitos, horas válidas, `satellite=N` e `instrument=VIIRS`. Los 14 archivos pasaron estos controles. No se guardó HTML, un error de servidor ni una cabecera sin observaciones como si fueran datos.

| Año | Registros originales | Bytes | Primera detección | Última detección | Días con detecciones |
| --- | ---: | ---: | --- | --- | ---: |
| 2012 | 80,482 | 6,410,998 | 2012-01-20 | 2012-12-31 | 346 |
| 2013 | 64,406 | 5,130,605 | 2013-01-01 | 2013-12-31 | 365 |
| 2014 | 57,655 | 4,594,579 | 2014-01-01 | 2014-12-31 | 363 |
| 2015 | 69,996 | 5,578,959 | 2015-01-01 | 2015-12-31 | 365 |
| 2016 | 91,343 | 7,281,547 | 2016-01-01 | 2016-12-31 | 365 |
| 2017 | 57,168 | 4,558,559 | 2017-01-01 | 2017-12-31 | 364 |
| 2018 | 63,185 | 5,035,858 | 2018-01-01 | 2018-12-31 | 365 |
| 2019 | 74,411 | 5,936,720 | 2019-01-01 | 2019-12-31 | 364 |
| 2020 | 98,416 | 7,853,597 | 2020-01-01 | 2020-12-31 | 366 |
| 2021 | 67,345 | 5,371,354 | 2021-01-01 | 2021-12-31 | 365 |
| 2022 | 89,579 | 7,142,122 | 2022-01-01 | 2022-12-31 | 350 |
| 2023 | 79,577 | 6,342,229 | 2023-01-01 | 2023-12-31 | 363 |
| 2024 | 99,932 | 7,963,113 | 2024-01-01 | 2024-12-31 | 346 |
| 2025 | 53,579 | 4,270,586 | 2025-01-01 | 2025-12-31 | 362 |
| 2026 | No adquirido: HTTP 404 | — | — | — | — |

El [índice oficial de archivos por país](https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt), descubierto en el JavaScript público de la página de descargas, enumera esos mismos 14 archivos de Perú. Sus 14 tamaños coinciden exactamente con los bytes recuperados; no enumera un CSV Suomi-NPP de Perú para 2026. Las fechas `updated` del índice se conservan como texto, porque no declara zona horaria. Son fechas de publicación, no cobertura del sensor. Tampoco equivalen necesariamente a `Last-Modified` de HTTP.

No se encontraron campos vacíos, números/horas inválidos ni filas idénticas completas. En 2022 hay **una colisión** de la clave latitud/longitud/fecha/hora: dos registros de `2022-08-25 18:06 UTC`, `(-12.28162, -73.94183)`, con FRP de `8.1` y `3.53` MW y temperaturas diferentes. No son copias exactas. Los originales se conservaron; cualquier deduplicación posterior debe declarar su criterio.

## Producto identificado y límites científicos

En todos los registros se observan `version=2`, `satellite=N`, `instrument=VIIRS` y la columna `type`. La [descripción oficial de atributos VIIRS](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) define `N` como Suomi-NPP, distingue procesamiento por el sufijo de `version` y reserva `type` para datos estándar. Esto sustenta identificar los archivos como **VIIRS Suomi-NPP de 375 m, Collection 2, procesamiento estándar (SP)**. La identificación procede de los campos y su documentación; no se deduce de que el año sea antiguo.

El [README del archivo por país](https://firms.modaps.eosdis.nasa.gov/data/country/AttributesReadme.txt) también remite a `Collection / Version` para distinguir SP/NRT e identifica las coordenadas como geográficas WGS84. NASA explica que el [archivo general](https://firms.modaps.eosdis.nasa.gov/download/) sustituye NRT por datos estándar conforme están disponibles, con un retraso de meses. No hay registros con sufijos NRT/RT/URT en estos CSV.

El número `2` del CSV identifica la colección; **no demuestra la revisión exacta de producción mensual**. Los [avisos oficiales FIRMS](https://firms.modaps.eosdis.nasa.gov/web-services/) describen una corrección de mayo de 2025 del campo `type` de Vxx14IMGML y reprocesamiento a revisión 3. Las fechas de publicación de los CSV históricos son posteriores, pero no bastan para certificar su cadena completa de reprocesamiento. No se afirma aquí una revisión mensual que el archivo no expone.

`type=0` significa fuego de vegetación presumido; no identifica por sí solo un incendio forestal, una superficie quemada o un incidente independiente. Una detección es un píxel térmico; FRP es potencia radiativa del píxel en MW. Los puntos pueden incluir fuentes no vegetales. No se aplicaron filtros científicos ni geográficos a los bytes adquiridos. El CSV no identifica la versión del límite nacional ni el método de recorte usado por el proveedor.

## Cobertura: evidencia disponible y lo que sigue desconocido

La [tabla oficial de datos faltantes](https://firms.modaps.eosdis.nasa.gov/api/missing_data/) explica que sus filas son días con datos faltantes por satélite y clase de procesamiento; NRT solo aparece después de la última fecha estándar disponible. Aunque la representación textual de la página mostraba un aviso de carga fallida, su solicitud pública anunciada en el propio HTML sí respondió correctamente:

```text
GET https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data
```

Se obtuvo HTTP 200, JSON `success=true`, y se analizaron separadamente las columnas SP y NRT. La instantánea conserva los registros de todos los productos y un subconjunto Suomi-NPP. Para Suomi-NPP SP, la fuente declara:

| Año | Fechas declaradas con datos faltantes | Cantidad de días |
| --- | --- | ---: |
| 2012 | 25 de marzo | 1 |
| 2022 | 27 de julio–10 de agosto | 15 |
| 2024 | 30 de mayo–3 de junio; 10–15 y 25–28 de julio; 26 de septiembre; 3–5 de noviembre | 19 |
| 2026 | Fechas individuales conservadas en la instantánea | 45 |

La tabla no suministra duración dentro del día, cobertura espacial de Perú ni visibilidad a través de nubes. **Una fecha ausente de la tabla no certifica cobertura completa.** En particular, el CSV peruano de 2025 contiene detecciones en 362 días, pero la tabla no declara días Suomi-NPP faltantes de ese año. No corresponde convertir automáticamente sus tres días sin detecciones —11 de febrero, 7 de julio y 11 de noviembre— en fallas del satélite.

La [API de disponibilidad](https://firms.modaps.eosdis.nasa.gov/api/data_availability/) documenta intervalos por producto SP/NRT mediante un endpoint que exige MAP_KEY. No se consultó con credenciales. Por ello, `firms-product-availability.json` deja los extremos del **intervalo SP/NRT actual exacto sin verificar**. Ni la última detección ni el índice de nombres permiten completar ese dato. Tampoco se obtuvo una máscara de cobertura por órbita, nubes o granulo.

## Suomi-NPP y el corte de 2026

En la fecha de auditoría, tanto la [página de descarga](https://firms.modaps.eosdis.nasa.gov/download/) como la [descripción VIIRS](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) publican cobertura general Suomi-NPP desde el 20 de enero de 2012 hasta el **2 de noviembre de 2026**. Esto no proporciona el corte SP y NRT por separado.

El [aviso de NASA/LP DAAC](https://forum.earthdata.nasa.gov/viewtopic.php?p=26519) anunció el cese previsto de entrega el 1 de noviembre de 2026 a las 13:00 UTC y advirtió que esa fecha podía cambiar. Se conservan ambas afirmaciones con su alcance; no se fuerza una equivalencia entre el anuncio previo y el rango publicado posteriormente por FIRMS. Una experiencia reciente debe comprobar disponibilidad del producto y no prometer continuidad futura de Suomi-NPP. Cambiar a NOAA-20/NOAA-21 requiere mantener explícita la distinción frente al baseline Suomi-NPP.

## Fallos y pendientes reproducibles

- `https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2026/viirs-snpp_2026_Peru.csv`: HTTP 404, registrado a `2026-11-16T01:22:25.107404+00:00`. No se guardó un CSV para ese año ni se añadió NRT artificial.
- La representación textual inicial de la página de datos faltantes mostraba error; la solicitud AJAX pública posterior sí funcionó. Se conserva la respuesta útil y se documenta esta diferencia.
- No se verificó el intervalo SP/NRT actual mediante la API con clave ni se probó la clave del equipo. La investigación no leyó archivos de credenciales.
- La disponibilidad de los originales actuales permite reconstruir un pipeline con estas fuentes. No demuestra que los JSON/WAV históricos del repositorio se generaran con los mismos bytes ni acredita cobertura continua, exactitud del recorte nacional, calidad de máscaras o validación humana del sonido.

Esta tarea de adquisición no modificó código Python/web ni creó commits. Los filtros, recorte, agregación, scores y sus pruebas pertenecen a la implementación posterior; cada resultado derivado debe referir los hashes de los archivos efectivamente usados.
