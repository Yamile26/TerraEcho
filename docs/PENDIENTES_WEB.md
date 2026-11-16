# TerraEcho: auditoría del desafío y trabajo pendiente

Revisión del 16 de noviembre de 2026 sobre `1cfb677`, rama `feat/terraecho-web-experience`. Se distinguen código presente, evidencia pendiente y propuestas. Las prioridades son del proyecto, no una evaluación oficial ni una garantía de premio.

## 1. La decisión principal

**El centro del producto debe ser explorar una imagen del EIC y comprender su traducción a sonido. FIRMS aporta contexto peruano y una segunda pista científica.** Un globo atractivo y una API conectada no sustituyen esa experiencia.

El enunciado compartido permite una herramienta interactiva o una colección de audios originales con visualizaciones y explicación. No exige Three.js, inteligencia artificial, todos los recursos disponibles, un servicio Python HTTP ni datos satelitales recibidos cada segundo. Una pieza puede sostener un prototipo; varias piezas son una mejora propuesta, no un mínimo oficial.

Python ya extrae rasgos del frame EIC y el navegador sintetiza audio con sus parámetros, permitiendo cambiar capas y posición. Esta arquitectura híbrida —análisis preparado y síntesis interactiva— es defendible. Falta mostrar y validar la relación entre imagen, rasgo y sonido, y demostrar su uso sin depender de la vista.

La apertura directa de la página oficial del desafío y las guías generales falló durante esta revisión. Se utilizó el enunciado completo aportado por el equipo y se verificaron páginas primarias NASA. Un índice del evento local HackAthlone se usó solo para localizar enlaces NASA. Antes de enviar, confirmar la pestaña Recursos y las reglas vigentes en la cuenta oficial; no se considera que la copia local sustituya esas reglas.

## 2. Estado comprobado

| Área                  | Evidencia actual                                                                                      | Límite                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Web                   | Next.js, React, TypeScript; paleta azul/turquesa, Tierra, mapa 2D, filtros, observatorio, tabla y CSV | La revisión visual anterior usó el globo compatible; falta comprobar WebGL acelerado en el equipo real                       |
| EIC                   | GEOS Aerosols, 19-ago-2025, 20:00 UTC; 104 pasos, cuatro capas y síntesis Web Audio                   | Un frame; sin resultados documentados de comprensión humana ni validación suficiente de máscaras                             |
| FIRMS histórico       | 2025: 52 semanas; 2026: 44. Comparadores desde 2012                                                   | Los demás años no son pistas navegables. Los huecos 28 y 44 de 2026 se infieren mediante una heurística pendiente de validar |
| Geografía             | Celdas de 0.5°; departamentos por centro de celda                                                     | El total general es de una caja geográfica, no de un recorte nacional                                                        |
| Ejemplo inspeccionado | Semana 40 de 2026: caja 9,058; suma departamental 5,921; 418 celdas                                   | Diferencia pendiente de reconciliación; no prueba que todos los puntos restantes sean extranjeros                            |
| Sonido                | Envolventes, compresor, volumen, paneo, capas EIC y hasta 18 celdas FIRMS de mayor FRP                | Sin mediciones de comprensión, confort, sincronización o representatividad de la reducción                                   |
| API                   | Proxy reciente con clave privada, validación, caché y límites                                         | El equipo ya tiene clave; no se recibió ni probó aquí. El mapa sigue consumiendo JSON históricos                             |
| Python                | Pipeline por lotes y adaptador web para proveedor HTTP futuro                                         | No existe todavía ese servicio HTTP ni actualización automática verificada                                                   |
| Accesibilidad         | Teclado, lectura hablada, tabla y pausa de movimiento                                                 | Faltan pruebas con lectores de pantalla y personas ciegas o con baja visión                                                  |
| Verificación          | 12 pruebas web, tipos, build y CI aprobados en `1cfb677`                                              | No prueban exactitud frente a descargas NASA originales ni interpretación del sonido                                         |
| Entrega               | `main`, `develop`, rama web y PR #1 hacia `develop`                                                   | La web no está integrada en las ramas base; no hay despliegue público verificado aquí                                        |

## 3. Activar la FIRMS_MAP_KEY en WSL

La clave debe permanecer en el equipo o servidor, fuera de chats y commits. Desde la raíz local:

```bash
cd ~/projects/TerraEcho
[ -f web/.env.local ] || cp web/.env.example web/.env.local
nano web/.env.local
```

Editar:

```dotenv
FIRMS_MAP_KEY=TU_CLAVE_REAL
TERRAECHO_PYTHON_API_URL=
```

Guardar con `Ctrl+O`, `Enter`; salir con `Ctrl+X`. Detener el servidor previo con `Ctrl+C` y ejecutar `npm run dev`. No usar `NEXT_PUBLIC_`; dejar vacía la URL Python mientras no exista ese servicio. No se necesita Docker.

En el navegador, usando el puerto que indique Next.js:

1. `/api/health` debe indicar `firmsConfigured: true`. Solo comprueba presencia de la variable, no validez frente a NASA.
2. **Fuentes y metodología → Comprobar conexión API** realiza la consulta real.
3. `/api/fires?mode=live&days=1` permite inspeccionar la respuesta: `meta.mode: "live"`, producto, fecha de consulta, `meta.anomalyComputed: false` y arreglo `observations`.

| Resultado                  | Interpretación                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 200 con observaciones      | Respuesta aceptada por el parser; registrar producto, fecha y cantidad sin secretos                                  |
| 200 vacío                  | No hubo detecciones devueltas para esa ventana; no demuestra cobertura completa ni ausencia de fuego                 |
| 503 `FIRMS_NOT_CONFIGURED` | Revisar ruta `web/.env.local`, nombre exacto de variable y reinicio                                                  |
| 502 `FIRMS_UNAVAILABLE`    | Revisar clave, red, timeout, disponibilidad y respuesta del producto. El código actual no distingue todas las causas |
| 429 `UPSTREAM_RATE_LIMIT`  | Se agotó el presupuesto por proceso; esperar la ventana indicada                                                     |

La API de área permite consultar 1–5 días y NASA ofrece un endpoint de disponibilidad. El código fija `VIIRS_SNPP_NRT`; no asumir que cualquier fecha tiene datos. Referencias: [Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) y [Data Availability](https://firms.modaps.eosdis.nasa.gov/api/data_availability/).

**La clave no actualiza automáticamente el globo.** `useDataset()` solicita `/api/fires?year=...`. El diálogo únicamente informa el resultado reciente, que no tiene anomalía calculada. Integrarlo exige un modo explícito o procesamiento compatible antes de mezclarlo con el histórico.

## 4. Inventario completo: 53 tareas

**P0:** necesario para defender el alcance prometido o hacer funcionar la entrega principal; se indican las condiciones. Reducir una promesa también puede cerrar un pendiente. **P1:** mejora importante de comprensión, evidencia o uso. **P2:** ampliación sujeta a necesidad comprobada. Son tareas pendientes, no funciones terminadas.

### A. EIC y adecuación al desafío

| ID / prioridad | Trabajo pendiente                                            | Criterio de cierre y justificación                                                                                                                                  |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 · P0       | Dar protagonismo a la sonificación EIC en el recorrido       | Una persona inicia una imagen EIC y explica qué escucha sin tener que recorrer antes FIRMS                                                                          |
| E02 · P0       | Crear ficha/manifiesto por pieza                             | URL exacta, recurso, fecha del fenómeno, descarga, créditos, imagen y versión de algoritmo; permite reconstruir el sonido                                           |
| E03 · P0       | Validar máscaras de color HSV                                | Mostrar máscaras y revisar muestras manualmente; documentar confusión con terreno, luces y superposición. La clasificación visual no equivale a concentración       |
| E04 · P0       | Mostrar imagen → rasgo → parámetro → sonido                  | Inspeccionar un paso permite reconocer capa, presencia visual, altura y nota/ganancia resultantes; hay equivalente textual                                          |
| E05 · P0       | Hacer coherente el relato EIC/Perú                           | Fechas y alcances separados. Una comparación conjunta requiere fuentes comparables; mostrar dos pistas no prueba causalidad                                         |
| E06 · P1       | Añadir 2–3 piezas o encuadres curados si aportan comparación | Cada pieza tiene pregunta, imagen, audio y explicación propios. Esta cantidad es propuesta, no requisito oficial                                                    |
| E07 · P1       | Explorar encuadre, repetir segmento y aislar capa            | El encuadre modifica realmente rasgos y sonido. `--crop` existe por lotes; no hay selector web. Sin georreferenciación validada, no llamarlo recorte exacto de Perú |
| E08 · P1       | Validar completamente el JSON EIC                            | Rechazar notas, ganancias, capas y coordenadas ausentes/no finitas; error y reintento. Hoy solo se comprueba que existan pasos                                      |

### B. Datos y validez científica

| ID / prioridad                             | Trabajo pendiente                                                                 | Criterio de cierre y justificación                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 · P0 si se prometen totales nacionales | Recortar puntos originales por Perú y asignarlos a departamentos antes de agregar | Reconciliar puntos, celdas, regiones y total; regenerar baseline y scores afectados. No arreglar solo el número de la pantalla                                                     |
| D02 · P0 para afirmar incendios forestales | Separar focos térmicos, quemas de vegetación e incendios en bosque                | Usar cobertura forestal con año/resolución e incertidumbre, o delimitar el producto como actividad térmica de vegetación                                                           |
| D03 · P0                                   | Conservar procedencia reproducible                                                | CSV originales accesibles según su política, producto/colección, sensor, periodo, filtros, fecha, hash y commit; reproducir una muestra. No hay CSV crudos en el checkout revisado |
| D04 · P0                                   | Validar detección de huecos y cobertura                                           | Distinguir ventana cubierta sin focos, falta de cobertura y fallo de descarga. Días sin detecciones no bastan para identificar una falla satelital                                 |
| D05 · P0                                   | Conservar FRP desconocida en Python                                               | `fillna(0)` no debe hacer pasar dato ausente por cero observado; reportar entradas válidas y política de exclusión                                                                 |
| D06 · P0                                   | Revisar mezcla SP/NRT y duplicados                                                | No asumir cobertura SP completa solo por su última fecha; conciliar por fechas/registros disponibles, con QA de vacíos y fuentes estáticas                                         |
| D07 · P0                                   | Fijar y explicar el baseline                                                      | El score 2025 usa también 2026: es retrospectivo. Para un uso prospectivo, solo historia disponible entonces. Documentar años efectivos y no llamarlo predicción                   |
| D08 · P1                                   | Evaluar resolución, suavizado y umbrales                                          | Sensibilidad de celda 0.5°, escala mínima 0.35 y z = 1/2.5/4. Revisar ceros de ventanas vecinas sin cobertura antes del suavizado                                                  |
| D09 · P1; P0 si se anuncia todo el rango   | Catálogo de años, cobertura y fecha de corte                                      | Para prometer 2012–2026 navegables, exportar años y generar selector/preparación desde catálogo. Hoy solo 2025/2026                                                                |
| D10 · P1                                   | Validar un caso peruano y unidades/tiempo                                         | Comparación con fuente independiente para el mismo ámbito; distinguir detecciones, incendios, área y FRP sumada. Revisar el bin final de 8/9 días en análisis y cobertura          |

FIRMS describe [anomalías térmicas de distintos orígenes y limitaciones por nubes](https://firms.modaps.eosdis.nasa.gov/map/index.html). Por eso "habitual" no significa bosque sano y "sin detecciones" no significa necesariamente sin fuego. GEDI tampoco aporta automáticamente una máscara forestal válida para cada año del alcance.

### C. FIRMS e integración

| ID / prioridad                        | Trabajo pendiente                                        | Criterio de cierre y justificación                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 · P0 para demostrar conexión      | Consultar con la clave local del equipo                  | Evidencia sin secretos: HTTP, producto, fecha y cantidad. `firmsConfigured` no equivale a consulta exitosa                                                     |
| F02 · P1; P0 si se promete actualidad | Llevar datos recientes al mapa/sonido                    | Archivo/Reciente explícitos, fechas, fuente y estados de carga/error; sin atribuir anomalía a observaciones crudas                                             |
| F03 · P0 si hay anomalía reciente     | Homologar filtros, geografía y producto con el baseline  | No comparar varios sensores crudos con historia filtrada de uno. Score reciente validado con la misma definición de variable                                   |
| F04 · P1                              | Comprobar disponibilidad y cambio controlado de producto | Sensor y ventana visibles; si cambia la fuente, explicar comparabilidad o emplear el baseline correcto                                                         |
| F05 · P1                              | Actualizar por lotes con QA y publicación atómica        | Un fallo no reemplaza el último score válido; registro de versión/fecha y comprobaciones. No procesar todo el histórico por visitante                          |
| F06 · P1 al publicar                  | Proteger credenciales y presupuestos en hosting          | Clave solo en servidor y fuera de logs; errores/timeout/límites verificados. Caché y cuota compartidas solo si hay varias instancias o carga que lo justifique |

### D. Ingeniería de sonido

| ID / prioridad | Trabajo pendiente                              | Criterio de cierre y justificación                                                                                                                |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 · P0       | Enseñar las dos gramáticas sonoras             | Leyenda audible/textual EIC y FIRMS; explicar qué controla tono, ritmo, timbre, ganancia, disonancia y paneo                                      |
| S02 · P0       | Medir mezcla, clipping, transiciones y confort | Aprovechar compresor/envolventes existentes; comprobar picos, pausas y cambios de capa sin clics/saltos. El código no acredita confort humano     |
| S03 · P1       | Usar reloj de audio para transporte            | EIC usa `setTimeout` de 250 ms. Programar con `AudioContext` y dibujar desde ese reloj; medir deriva y respuesta mientras se mueve el globo       |
| S04 · P1       | Justificar las 18 voces de mayor FRP           | Mostrar número de celdas y proporción de conteo/FRP representada; evaluar anomalías omitidas y escucha individual                                 |
| S05 · P0       | Medir comprensión del mapeo                    | Comparaciones controladas: reconocer rasgo/capa/anomalía, no solo elegir lo más fuerte o alarmante. No atribuir utilidad sin resultados           |
| S06 · P0       | Distinguir silencios y estados                 | Pausa, falta de detecciones y datos insuficientes se anuncian inequívocamente. Un sonido de interfaz debe distinguirse de una observación         |
| S07 · P1       | Comparar WAV de referencia y síntesis web      | Mismo fragmento, capas, parámetros y balance; explicar normalización relativa. Ganancias normalizadas por capa no permiten comparar concentración |
| S08 · P1       | Añadir comparación A/B y exportación útil      | Fragmento original con fuente/configuración; condiciones comparables o diferencias explícitas. No usar música de fondo como resultado científico  |

### E. Accesibilidad e impacto

| ID / prioridad                            | Trabajo pendiente                                | Criterio de cierre y justificación                                                                                                               |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 · P0                                  | Inicio comprensible sin mirar                    | Explicar datos, controles y sonido; poder iniciar/parar y cambiar selección. Lectura hablada complementa, no sustituye, sonificación             |
| A02 · P0                                  | Recorrido completo con teclado y lector          | Pieza/capa/región, play, pausa, volumen, fuente y modales sin ratón, foco perdido o barreras de canvas                                           |
| A03 · P0 para sostener inclusión validada | Evaluación con personas ciegas o con baja visión | Tareas, consentimiento, barreras, correcciones y nueva comprobación. Videntes con ojos cerrados no sustituyen esa participación                  |
| A04 · P0                                  | Medir y reportar impacto real                    | n real, aciertos, tiempos, tareas completadas y confort; separar EIC de FIRMS. Sin porcentajes inventados ni generalización de un piloto pequeño |
| A05 · P1                                  | Contraste, tipografía, reflujo y controles       | Revisión manual/automática de WCAG 2.2 aplicable, ampliación y móvil; corregir textos diminutos y no depender de color/arrastre                  |
| A06 · P1                                  | Voz, mono/estéreo y preferencias en equipo real  | Lector/navegador pertinentes, alternativa textual, movimiento y volumen controlables; evitar competencia entre narración y música                |

Propuesta de piloto formativo: 5–8 personas, procurando 2–3 ciegas o con baja visión si puede hacerse adecuadamente. Son cantidades propuestas para descubrir barreras, no requisito NASA ni prueba estadística de eficacia. Tareas: localizar un intervalo con mayor presencia de una capa EIC; comparar anomalías FIRMS; completar el recorrido sin asistencia. Balancear orden y registrar respuestas anonimizadas. `listening_test.py` genera clips FIRMS; no contiene resultados ni valida EIC.

La [referencia WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) ayuda a organizar alternativas, teclado, audio, foco, contraste y reflujo. Añadir ARIA o voz no demuestra cumplimiento.

### F. Exploración espacial y UX

| ID / prioridad | Trabajo pendiente                            | Criterio de cierre y justificación                                                                                                         |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| U01 · P0       | Revisar WebGL real y oclusión de marcadores  | Textura/coordenadas correctas, reset y tacto; no seleccionar puntos del hemisferio posterior a través de la Tierra                         |
| U02 · P1       | Recuperar contexto y errores de carga        | Detener/liberar Three.js antes de la alternativa; límites/EIC con error y reintento, no fallos silenciados                                 |
| U03 · P1       | Inspección por cursor, clic, teclado y tacto | Contenido, unidades y selección equivalentes. Hover no puede ser el único acceso                                                           |
| U04 · P1       | Mantener selección coherente                 | Región/semana coinciden en mapa, métrica, tabla y audio FIRMS; EIC conserva fecha y escala independientes                                  |
| U05 · P1       | Compartir y repetir una experiencia          | URL o configuración recuperable de pieza, región, tiempo y capas sin credenciales                                                          |
| U06 · P1       | Medir desempeño y consistencia visual        | Globo y audio simultáneos en equipo objetivo; carga acotada, legibilidad, pausa y 2D. Órbitas/ondas siguen identificadas como ilustrativas |

### G. Entrega y presentación

| ID / prioridad                  | Trabajo pendiente                                 | Criterio de cierre y justificación                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 · P0 para evaluación remota | Publicar HTTPS y probar desde fuera               | Enlace público sin login; EIC, audio, histórico, API y activos en build limpio. Localhost no basta                                                                                     |
| R02 · P0                        | Versión identificable y flujo de integración      | Commit/tag, CI y recorrido EIC/FIRMS/errores/alternativa. Pruebas que detecten fallos reales                                                                                           |
| R03 · P0                        | Corregir contradicciones del README y relato      | Delimitar "silencio significa sin fuego", años explorables, bosque sano y causalidad EIC/FIRMS. Nunca presentar fixtures sintéticos como observaciones                                 |
| R04 · P0                        | Demo con EIC primero y evidencia después          | Problema de acceso → imagen → diferencia sonora explicada → uso sin vista → hallazgo/límites. La guía interna de dos minutos no fija el formato oficial                                |
| R05 · P0                        | Licencia, atribución, autoría y herramientas/IA   | Equipo elige licencia; cita datos y activos, explica audio original y cumple reglas de declaración. No asumir permiso para extraer música/material de terceros de cualquier vídeo NASA |
| R06 · P0                        | Confirmar reglas, formato, idioma y plazo de sede | Guía vigente leída, enlaces públicos y envío confirmado. No trasladar reglas de otra sede/año                                                                                          |
| R07 · P1                        | Ramas y alternativa de demostración               | PR a `develop` y entrega a `main` cuando corresponda; política de ramas con propietaria. Build/audio locales o grabación identificada si falla Internet                                |
| R08 · P1                        | Decisiones técnicas y trabajo independiente       | Responsable, contrato y cierre por ciencia, EIC, señales, acceso, web y entrega; sin bloquear todo por un futuro servidor Python                                                       |
| R09 · P2                        | Servicios y escalado solo por necesidad           | Medición que justifique base de datos, caché compartida, colas, contenedores o backend Python independiente                                                                            |

El calendario oficial 2026 anuncia cierre el 15 de noviembre a las 23:59 en horario local: confirmar el de la sede y cualquier instrucción vigente; no asumir prórroga. Un evento 2026 en el dominio oficial publica impacto, creatividad, validez, relevancia y presentación como criterios. Las guías globales completas no pudieron abrirse en esta revisión; no se asigna a TerraEcho una puntuación oficial.

## 5. Justificación tecnológica

| Decisión                                            | Problema concreto que resuelve                                | Límite y evidencia requerida                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Next.js                                             | Interfaz, activos y proxy con clave privada en una aplicación | Probar API/assets en hosting; otro backend no aporta solo por reenviar HTTP                                  |
| React                                               | Sincronizar selección, capas, métricas y controles            | No usar su render como reloj musical                                                                         |
| TypeScript + validación runtime                     | Contrato web/Python y rechazo de datos rotos                  | Los tipos por sí solos no validan JSON remoto; ampliar parser EIC                                            |
| Three.js                                            | Ubicar y explorar geográficamente los fenómenos               | El reto debe seguir funcionando en 2D y sin depender de la vista; órbitas decorativas no son ciencia orbital |
| Web Audio API                                       | Síntesis interactiva, timbres, paneo, ritmo y disonancia      | Medir sincronización, confort y comprensión; no es música de fondo                                           |
| Python + NumPy/Pandas                               | Limpieza, baseline, rasgos y resultados reproducibles         | Priorizar lotes versionados; no recalcular todo por visitante                                                |
| Shapely/equivalente                                 | Pertenencia territorial antes de agregar                      | Validar geometrías, coordenadas, fronteras y política de bordes                                              |
| Máscaras de color                                   | Traducción visual explicable de EIC                           | Validar confusiones; ML solo si un problema real y una evaluación justifican su mejora                       |
| Baseline robusto/logaritmos                         | Comparación estacional y compresión de rango                  | Sensibilidad y alcance retrospectivo; no equivale a predicción                                               |
| Escalas, timbres y límite de voces                  | Evitar mezcla caótica y hacer diferencias reconocibles        | Decisiones artísticas declaradas, reducción visible y prueba perceptual                                      |
| JSON versionado/manifiesto                          | Carriles independientes y repetición de una pieza             | Esquema, unidades, procedencia y algoritmo; no exige BD para el prototipo                                    |
| FastAPI, Docker, Redis, colas, Workers/AudioWorklet | Cómputo, aislamiento o escala cuando hagan falta              | Añadir únicamente tras identificar la necesidad; no son requisitos del desafío                               |

La [documentación Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) describe síntesis, nodos, ganancia, procesamiento, paneo y control temporal. La eficacia del mapeo elegido debe comprobarse en TerraEcho.

## 6. Selección de recursos

| Recurso NASA                                                                        | Uso apropiado                                                               | Límite                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [EIC Content Database](https://svs.gsfc.nasa.gov/gallery/earth-information-center/) | Elegir piezas con pregunta y mantener catálogo/créditos                     | No hace falta implementar toda la galería                                                            |
| [GEOS Aerosols 5669](https://svs.gsfc.nasa.gov/5669/)                               | Base actual: cuatro colores y cuatro voces, exploración de presencia visual | Frame modelado global del 19-ago-2025; no sensor local de humo de una semana de 2026                 |
| [Caldwell 73, 13786](https://svs.gsfc.nasa.gov/13786/)                              | Antecedente posición/color → sonido; reconocer y explicar la adaptación     | Sonificación astronómica; no copiar su audio como resultado original ni atribuirse el concepto       |
| [Air Quality Model Runs 5533](https://svs.gsfc.nasa.gov/5533/)                      | Posible pista complementaria con leyenda, fecha y modelo propios            | Un color no se vuelve automáticamente una concentración cuantitativa                                 |
| [GEDI Forest Height 4950](https://svs.gsfc.nasa.gov/4950/)                          | Contexto de estructura forestal o pieza adicional                           | Usa datos 2019–2020; no prueba daño por fuego en 2026 ni cobertura forestal para todos los años      |
| [FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/)                             | Contexto térmico peruano con fuente, fecha, filtros y cobertura             | No identifica por sí solo todos los incendios forestales, superficie quemada ni causalidad sobre EIC |

Océanos, CO₂, luces nocturnas y otros recursos pueden ampliar el catálogo después, con mapeo propio. Añadirlos sin una pregunta dispersa el relato regional de bosque, fuego y acceso a la ciencia.

## 7. Evidencia para cada criterio

| Criterio     | Mostrar                                                                                 | Lo que no lo sustituye                                     |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Relevancia   | Imagen EIC que cambia de sonido al explorar, con explicación                            | Un mapa de incendios con música independiente de la imagen |
| Validez      | Manifiesto, máscaras revisadas, baseline, unidades, incertidumbre y muestra reproducida | Compilar o sonar dramático                                 |
| Impacto      | Participantes comprendiendo rasgos y completando tareas; resultados reales              | Declarar inclusión universal                               |
| Creatividad  | Adaptación útil al contexto peruano y a comparar/escuchar incertidumbre                 | Añadir IA, globo o servicios sin función demostrable       |
| Presentación | Caso breve, diferencia audible, fuente/fecha y conclusión clara                         | Enseñar todas las pantallas o librerías                    |

Cerrar ocho puertas antes de ampliar: EIC protagonista, traducción verificable, alcance honesto, datos reproducibles, sonido controlado, acceso no visual probado, enlace estable y envío conforme a reglas. Si queda poco tiempo, limitar piezas/años antes de afirmar funciones o evidencia inexistentes.

## 8. Orden y carriles

1. Configurar clave, consultar y registrar resultado sin secretos; no confundirlo con modo reciente completo.
2. Hacer que la imagen EIC se escuche y entienda primero; FIRMS aporta contexto regional.
3. Elegir conjunto defendible, corregir o delimitar geografía/forestal/cobertura y regenerar lo afectado.
4. Comprobar sonido y recorrido con participantes; corregir barreras y registrar resultados reales.
5. Publicar commit verificado, comprobar demo y enlaces, completar atribuciones y confirmar envío.
6. Ampliar catálogo/años y automatización después del núcleo.

| Carril           | Entrega independiente                           | Contrato                                                   |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Ciencia FIRMS    | Datos con QA/cobertura y score                  | JSON y manifiesto versionados                              |
| EIC              | Imagen, ficha, máscaras, rasgos y partitura     | Catálogo/esquema validados                                 |
| Señales          | Motor, gramática y evaluación perceptual        | Parámetros compartidos y WAV de referencia                 |
| Accesibilidad/UX | Recorrido, barreras y pruebas con participantes | Mismas piezas y tareas verificables                        |
| Web/entrega      | Interfaz, proxy, CI, publicación y demo         | Contratos y fixtures claramente separados de observaciones |

## Fuentes y alcance de la auditoría

- [Desafío del equipo](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/?tab=resources): texto completo aportado en conversación; extracción oficial completa no disponible aquí.
- [Calendario oficial 2026](https://www.spaceappschallenge.org/2026/) y [criterios en evento oficial 2026](https://www.spaceappschallenge.org/2026/local-events/ajmer/): recuperados por búsqueda en el dominio oficial.
- [Guía de entrega](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [evaluación](https://www.spaceappschallenge.org/resources/judging-awards-guide/): verificar versiones vigentes; no pudieron abrirse completamente.
- [Condiciones Space Apps](https://www.spaceappschallenge.org/legal/): búsqueda oficial indica documentación de licencia y fuentes. Confirmar texto antes del envío; no se aceptaron condiciones en esta revisión.
- Las páginas NASA, W3C y MDN enlazadas fueron consultadas directamente, salvo limitaciones indicadas.
- Evidencia local: `terraecho/pipeline.py`, `sonify.py`, `frames.py`, `run.py`, `run_eic.py`, `scripts/download_firms.py`, `scripts/listening_test.py`, `web/src/app/api/`, `web/src/lib/`, `web/src/components/`, `web/src/hooks/use-dataset.ts`, `web/scripts/prepare-data.mjs`, README y documentación existente.
- No se usaron credenciales del equipo, no se regeneró el histórico ni se hicieron nuevas sesiones de usuarios. La auditoría no modifica el motor ni las observaciones de la aplicación.
