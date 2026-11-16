# EIC: procedencia, encuadres y límites de las máscaras

Auditoría del **16 de noviembre de 2026**. Fuente local: `data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png`. Registro legible por máquina: [`data/manifests/eic-source.json`](../../data/manifests/eic-source.json). Esta revisión documenta procedencia y comportamiento del clasificador; no contiene resultados de una evaluación humana ni valida concentraciones de aerosoles.

## 1. Qué está verificado

La página primaria [NASA SVS 5669](https://svs.gsfc.nasa.gov/5669/) enlaza el PNG de 1920 × 1080 y su leyenda. La visualización representa el modelo GEOS el **19 de agosto de 2025 a las 20:00 UTC**; la página se publicó el **10 de agosto de 2026**. Son fechas distintas. El dataset identificado es **GEOS-FP 2Km Replay**, de tipo modelo; el PNG es una ilustración renderizada, no el campo numérico original.

| Archivo del repositorio | Dimensiones | SHA-256 |
| --- | --- | --- |
| Frame de sonificación | 1920 × 1080 | `0c6a8f6c46fb52a2f9a636bbd804fc6e5e23454dcb2f0d3fe04c653c772e8a7a` |
| Leyenda `Aerosols_cbar.png` | 1500 × 300 | `e3a280ef5b9598f6c9c765d43a5cc10fe4c9865b13cd471b1e80543643a11ec3` |
| Variante de impresión | 1500 × 1179 | `68a8b2294943a50eafd347e085a440b7113142333cf89ff7cd238071bcf04078` |

Los enlaces oficiales se abrieron durante la revisión. La descarga binaria directa devolvió HTTP 503: **no se certifica una comparación byte a byte nueva con el servidor**. Los hashes identifican los archivos presentes. Se desconoce cuándo se descargaron originalmente; ni `mtime` ni las fechas de edición XMP prueban una descarga. El manifiesto conserva ese dato como `null`.

**Actualización posterior de adquisición:** una nueva descarga del frame fuente terminó el 16 de noviembre de 2026 a las 03:58:08.014 UTC (15 de noviembre, 22:58 en Lima), con HTTP 200 y 2,768,951 bytes. Su SHA-256 y todos sus bytes coinciden con el frame versionado. La adquisición se registra separadamente como `verified_reacquisition`; no recupera ni reemplaza la fecha original desconocida. Las tres lecturas usan este mismo frame y su catálogo/ficha conserva ambas situaciones. En ese intento la leyenda y la variante de impresión siguieron devolviendo HTTP 503; no se certifica una nueva igualdad de esos dos archivos. El resultado por activo está en [`eic-reacquisition-check.json`](../evaluation/eic-reacquisition-check.json).

La variante de impresión tiene otra composición y no debe sustituir el frame manteniendo sus mismas coordenadas. Tampoco se confirmó la inclusión explícita de 5669 en la [galería EIC recuperada](https://svs.gsfc.nasa.gov/gallery/earth-information-center/); la fuente NASA exacta sí está identificada.

## 2. Leyenda y antecedente de sonificación

La leyenda oficial tiene cuatro categorías, sin escala numérica ni unidades. La descripción de la página asocia el naranja/rojo con humo; la etiqueta de la leyenda es **Black Carbon**. Usar “color de humo / carbono negro” comunica esa diferencia sin convertir una coincidencia cromática en análisis químico.

| Clave | Etiqueta de la leyenda | Píxel de muestra en la leyenda `(x,y)` | RGB de 8 bits | Hue calculado |
| --- | --- | --- | --- | --- |
| `black_carbon` | Black Carbon | (300, 185) | (210, 94, 69) | 10.638° |
| `dust` | Dust | (600, 185) | (193, 154, 220) | 275.455° |
| `sea_salt` | Sea Salt | (900, 185) | (133, 170, 169) | 178.378° |
| `sulfate` | Sulfate | (1200, 185) | (83, 220, 52) | 108.929° |

Los cuatro centros de muestra entran en las ventanas actuales. Esto comprueba compatibilidad con las muestras; **no valida la amplitud de las ventanas** ni la clasificación de mezclas del frame.

[Caldwell 73, SVS 13786](https://svs.gsfc.nasa.gov/13786/) acredita a SYSTEM Sounds (M. Russo, A. Santaguida) y NASA Goddard. Su barrido gira; la distancia radial controla el tono y el color selecciona instrumentos. TerraEcho adapta la idea mediante barrido horizontal, altura de imagen y síntesis propia. Debe describirse como inspiración; no se reutiliza su audio ni se reproduce su algoritmo.

## 3. Auditoría del clasificador de partida

Base inspeccionada: `terraecho/frames.py`, SHA-256 `9acdcde5e894b5898f09eb6ab04ef4ad786622dbc975a9b45fb195ddebb89471`, en la revisión `2bd392fbfc0f34a133f7005f7fd776abec42d0c9`. Es una referencia histórica; cualquier cambio posterior necesita registrar su propia versión.

El algoritmo usa hue, saturación mínima 0.15 y valor mínimo 0.20. Dentro de cada ventana asigna peso `saturación × valor`, equivalente al croma `max(R,G,B) − min(R,G,B)` para RGB normalizado. Fuera asigna cero. No utiliza una escala física proporcionada por NASA.

| Capa | Ventanas de hue, grados, extremo superior excluido | Fracción global de píxeles con peso positivo |
| --- | --- | --- |
| `black_carbon` | [345,360), [0,45) | 0.016668596 |
| `dust` | [245,300) | 0.028861883 |
| `sea_salt` | [160,230) | 0.092037519 |
| `sulfate` | [80,150) | 0.206752025 |

Estas fracciones se calcularon sobre los 2,073,600 píxeles. No son proporciones de superficie terrestre, masa, concentración ni extensión atmosférica. El render no documenta aquí una transformación inversa que permita obtener esas magnitudes.

La inspección visual del original y un acercamiento con el punto marcado mostró un caso ambiguo sobre Groenlandia: **(700,100)** tiene RGB **(61,75,55)**, H=102°, S=0.266667, V=0.294118. El algoritmo lo asigna a `sulfate` con peso **0.078431373**. En el rectángulo `[672,64,748,118)` la cobertura de esa máscara es **0.671783626**. La región parece mayormente un fondo cartográfico apagado; con el compuesto final no puede establecerse si el tinte procede del fondo o de una capa atmosférica. **Es un candidato de confusión visual, no una etiqueta humana ni un falso positivo físico demostrado.**

Otros píxeles inspeccionados y calculados, con origen arriba a la izquierda y coordenadas de base cero:

| Punto `(x,y)` | RGB | Salida actual | Qué demuestra |
| --- | --- | --- | --- |
| (920,410) | (155,119,184) | `dust`, peso 0.254901961 | La zona violeta visible entra en su ventana |
| (960,550) | (86,44,15) | `black_carbon`, peso 0.278431373 | El naranja oscuro visible entra en su ventana |
| (409,841) | (34,52,75) | `sea_salt`, peso 0.160784314 | El azul visible entra en su ventana |
| (960,1050) | (62,69,61) | Ninguna | Un fondo gris verdoso queda fuera por saturación |

No se anotaron estos puntos como verdad de terreno. Iluminación, luces, terreno, transparencia y superposición pueden cambiar hue y croma. Una sola máscara puede contener esos componentes y también perder colores de una capa real. El umbral no separa sus causas. Hace falta inspección contextual y, para validar cantidades físicas, los campos del modelo y su transformación de visualización.

En el método de partida, la ganancia se normaliza por el percentil 98 **de cada capa y del encuadre elegido**. Una capa escasa puede sonar fuerte frente a su propio máximo; no significa que supere a otra capa en cantidad. La altura ponderada representa una coordenada de imagen: no llamarla latitud, elevación ni distancia real.

### Diagnóstico de una regla conservadora por capa

La revisión acordada mantiene las ventanas de hue y V ≥ 0.20, con S ≥ **0.35 para `black_carbon` y `sulfate`** y S ≥ **0.15 para `dust` y `sea_salt`**. Se verificó el resultado de esa regla con cálculos locales: conserva los cuatro centros de la leyenda, anula el peso del punto (700,100) y reduce la cobertura de la máscara verde en el pequeño parche de Groenlandia de 0.671783626 a 0.076267057. No elimina todos los posibles componentes de fondo.

| Capa | Cobertura cromática global con la regla revisada |
| --- | --- |
| `black_carbon` | 0.014864487 |
| `dust` | 0.028861883 |
| `sea_salt` | 0.092037519 |
| `sulfate` | 0.155280671 |

Un único umbral S ≥ 0.35 para todas las capas excluiría los centros oficiales de polvo (S=0.300000) y sal marina (S=0.217647); por eso no se aplica indiscriminadamente. Estos diagnósticos motivan una **regla de rasgos de imagen**, no demuestran mejor precisión ni una segmentación física validada. Las anotaciones humanas y la medida de exactitud siguen pendientes. El CSV conserva las predicciones del método de partida, identificadas por su hash; no mezclar ambas versiones al evaluar.

## 4. Tres recorridos defendibles del mismo frame

Los tres comparten la fecha y el archivo originales; no son tres observaciones ni tres periodos.

| Recorrido | Caja fraccionaria `(x0,y0,x1,y1)` | Píxeles de origen, límite final excluido | Pregunta y límite |
| --- | --- | --- | --- |
| Panorama global | (0,0,1,1) | [0,0,1920,1080) | Comparar el recorrido de los colores en toda la imagen |
| Aislar el color del humo | (0,0,1,1) | [0,0,1920,1080) | Escuchar solo `black_carbon`; aislamiento de voz/máscara, no separación química |
| Sudamérica: encuadre visual aproximado | (0.26,0.43,0.42,0.83) | [499,464,806,896) | Explorar el continente visible y aguas próximas; no representa un límite nacional |

Las coordenadas se eligieron tras visualizar el frame real, sin inferir una proyección. El ejemplo anterior de `run_eic.py`, `(0.18,0.35,0.42,0.85)`, incluye bastante más océano y Caribe, además del remolino visible al norte. El encuadre propuesto concentra la comparación sin prometer un recorte exacto. No usarlo como “Perú”, estadística nacional ni consulta geográfica. Dentro del encuadre, arriba significa arriba del recorte.

## 5. Reproducción sin sobrescribir resultados

Desde la raíz del repositorio, en un entorno con las dependencias de `requirements.txt`, este bloque carga **en memoria** el código histórico identificado en el manifiesto; no modifica la rama actual:

```bash
python - <<'PY'
import hashlib, json, subprocess, types
from pathlib import Path
from PIL import Image
import numpy as np
m = json.loads(Path('data/manifests/eic-source.json').read_text())
b = m['baseline_mask_audit']
source = subprocess.run(
    ['git', 'show', b['audit_basis_repo_revision'] + ':' + b['audited_source_path']],
    check=True, capture_output=True).stdout
assert hashlib.sha256(source).hexdigest() == b['audited_source_sha256']
baseline = types.ModuleType('terraecho._eic_audit_baseline')
baseline.__package__ = 'terraecho'
exec(compile(source, '<audited frames.py>', 'exec'), baseline.__dict__)
p = Path('data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png')
im = Image.open(p).convert('RGB')
print('sha256', hashlib.sha256(p.read_bytes()).hexdigest())
print('dimensions', im.size)
masks = baseline.layer_masks(np.asarray(im, dtype=float) / 255)
for name, mask in masks.items():
    print(name, 'coverage', float((mask > 0).mean()),
          'Greenland patch coverage', float((mask[64:118,672:748] > 0).mean()))
print('frames.py sha256', hashlib.sha256(Path('terraecho/frames.py').read_bytes()).hexdigest())
PY
```

Estos comandos generan audios con **la implementación actual** de la rama. Sus metadatos y reglas pueden diferir de la tabla histórica; usar un destino temporal evita sobrescribir resultados:

```bash
python run_eic.py --out /tmp/terraecho-eic-audit --name audit_global
python run_eic.py --out /tmp/terraecho-eic-audit --crop 0.26 0.43 0.42 0.83 --name audit_south_america_approx
```

Para el método auditado, las cajas usan `int(fracción × dimensión)` y corte NumPy con extremo final excluido. El render global también produce un WAV individual por capa. Entorno de esta inspección: Python 3.12.14, NumPy 2.3.5, Pillow 13.0.0. La igualdad de archivos WAV entre otras versiones/plataformas no está certificada.

## 6. Revisión humana pendiente

[`eic-mask-annotation-template.csv`](../evaluation/eic-mask-annotation-template.csv) contiene **40 ubicaciones**, ocho por cada una de las cuatro máscaras y ocho sin asignación, seleccionadas sin reemplazo con `np.random.default_rng(5669)`. Coordenadas, estratos y predicciones se calculan automáticamente; **las columnas de revisión están vacías**. No contiene respuestas de participantes, precisión, acuerdo ni resultados inventados. Sus predicciones corresponden al clasificador de partida identificado arriba.

Procedimiento propuesto:

1. Comprobar el hash del frame y registrar la versión del algoritmo. Mostrar cada punto con contexto y la leyenda original; ocultar al revisor las columnas de predicción.
2. Revisar el aspecto visual con etiquetas `black_carbon_color`, `dust_color`, `sea_salt_color`, `sulfate_color`, `background`, `ambiguous` o `unreadable`. Registrar certeza, identificador anónimo, fecha y notas. No forzar una categoría en mezclas.
3. Revisar las discrepancias con otra persona. Mantener los casos ambiguos en el informe y distinguir acuerdo de revisores de exactitud física.
4. Publicar recuentos por estrato, confusiones y casos no evaluables. La muestra está equilibrada por estrato; un porcentaje agregado sin ponderar no estima precisión global. Ocho puntos por estrato es una comprobación exploratoria pequeña, no una validación estadística concluyente.

Una inspección por IA de colores y coordenadas no sustituye esta revisión humana. La evaluación de comprensión, comodidad y acceso de personas ciegas o con baja visión es otra tarea: aquí no se realizó ningún estudio de usuarios.

## 7. Créditos y condiciones de reutilización

Conservar los créditos por archivo del manifiesto; atribuir la imagen a NASA GMAO/SVS y la transformación y sonido a TerraEcho. Las [directrices de imágenes y medios de NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/) permiten en general uso educativo/informativo sujeto a sus condiciones, piden reconocimiento y excluyen cualquier insinuación de respaldo. El alojamiento por NASA no transfiere derechos de terceros. No se encontró un aviso separado de copyright de terceros en la entrada 5669 consultada, pero eso no es una autorización general para cualquier recurso NASA ni una licencia CC.

Los [emblemas e identificadores de NASA](https://www.nasa.gov/nasa-brand-center/brand-guidelines/) tienen protección aparte: los créditos del frame no autorizan usarlos como marca de TerraEcho. La sonificación derivada y sus afirmaciones son responsabilidad del proyecto; no afirmar aprobación o validación por NASA. Estas notas registran las condiciones publicadas; no certifican un permiso individual.

Fuentes primarias consultadas: [SVS 5669](https://svs.gsfc.nasa.gov/5669/), [PNG del frame](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png), [PNG de la leyenda](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_cbar.png), [SVS 13786](https://svs.gsfc.nasa.gov/13786/), [galería EIC](https://svs.gsfc.nasa.gov/gallery/earth-information-center/) y las dos páginas de condiciones enlazadas arriba. Las cifras de máscaras y muestras RGB proceden de cálculo sobre los archivos locales, no de una afirmación NASA.
