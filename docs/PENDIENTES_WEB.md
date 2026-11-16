# Qué falta para completar TerraEcho

Inventario basado en el código y los archivos del repositorio, revisados después de crear `main` y `develop`. P0 significa necesario para sostener la demo y sus afirmaciones; P1 mejora comprensión, calidad y confianza; P2 corresponde a expansión o mayor escala. No es una evaluación oficial del jurado ni una garantía de premio.

## Estado que ya se puede demostrar

Existe una web Next.js con exploración espacial, partitura FIRMS, filtros regionales, mapa 2D, observatorio, tabla, CSV, lectura hablada y estudio de un frame EIC. El pipeline Python por lotes existe y se conserva. Las pruebas verifican contratos, consistencia con los agregados del pipeline, errores y huecos de datos; no prueban por sí solas la exactitud científica frente a los archivos NASA originales o la comprensión del sonido por personas ciegas.

## Datos y validez científica

| Prioridad | Estado observado | Trabajo pendiente y criterio de cierre |
| --- | --- | --- |
| P0 | El agregado `country` suma la caja geográfica; no aplica un recorte al contorno nacional | Filtrar observaciones originales por el territorio peruano antes de agregar y regenerar baseline, agregados y partituras. No corregir solo el total mostrado en el navegador |
| P0 | En la semana 40 de 2026 el agregado general es 9,058 y la suma regional 5,921 | Reconciliar la cobertura y documentar el resultado. La diferencia no prueba que todos los puntos excluidos sean extranjeros: también interviene la asignación por centro de celda |
| P0 | Solo se incluyen partituras de 2025 y 2026; `prepare-data.mjs` y el selector tienen esos años fijados | Para ofrecer 2012–2026 como años explorables, exportar los años disponibles y añadir un catálogo de cobertura; actualizar carga y selector. No basta con añadir opciones vacías |
| P0 | 2026 termina en la semana del 29 de octubre y se considera provisional | Mostrar fecha de corte y consulta, cobertura por producto y estado provisional. No presentar ese archivo como una captura actualizada hasta hoy |
| P0 | El checkout no contiene los CSV originales y un manifiesto suficiente para reproducir cada exportación | Conservar fuente, producto/versión, periodo, fecha de descarga, licencia/atribución y hashes; regenerar una muestra y comprobar sus conteos |
| P0 | `aggregate()` infiere huecos a partir de días sin detecciones y un patrón histórico | Contrastar con disponibilidad del producto, integridad de descargas u otra evidencia de cobertura. Un día sin focos no demuestra por sí solo una falla del satélite |
| P1 | Las regiones se asignan por el centro de celdas de 0.5°, no por cada punto original | Evaluar pérdidas/asignaciones en fronteras y, si se necesitan cifras territoriales precisas, asignar puntos antes de agregarlos. Rotular el mapa como celdas agregadas |
| P1 | El z-score usa una comparación retrospectiva con otros años y umbrales elegidos por el equipo | Documentar sensibilidad a baseline, escala mínima y umbrales; no presentarlo como pronóstico de incendios o validación operativa de alertas |
| P1 | Hay coincidencias narradas con acontecimientos, sin una evaluación formal de exactitud | Diseñar una comprobación reproducible con referencias independientes y reconocer falsos positivos/negativos; evitar atribuir precisión no medida |

Evidencia principal: `terraecho/pipeline.py`, `run.py`, `terraecho/sonify.py`, `data/scores/` y `web/scripts/prepare-data.mjs`.

## Conexiones y actualización

| Prioridad | Estado observado | Trabajo pendiente y criterio de cierre |
| --- | --- | --- |
| P0 | El proxy FIRMS existe, pero no se suministró una clave en esta revisión | Verificar una consulta satisfactoria con una clave real del equipo, fecha y producto disponibles; conservar los errores visibles |
| P0 si se promete actualidad | El botón de conexión solo informa cuántas detecciones respondió FIRMS | Añadir un modo reciente explícito con mapa, fechas, procedencia y estados de carga/error. No mezclar detecciones crudas con anomalías históricas ya procesadas |
| P1 | Python funciona por lotes; no hay FastAPI/otro servidor ni `GET /v1/scores/{year}` implementado | Crear el servicio de partituras, validar el contrato, añadir pruebas de integración y probar recuperación ante errores. El adaptador de Next.js ya está preparado |
| P1 | No existe una tarea programada que descargue, valide y publique nuevos scores | Diseñar actualización idempotente, registro de ejecución, control de calidad y publicación atómica de un dataset válido |
| P1 | El catálogo de datos y la API no tienen un versionado de esquema explícito | Añadir versión, procedencia, cobertura y compatibilidad; probar que un score válido no contradiga el año solicitado o los campos regionales |
| P2 | Caché y presupuesto FIRMS son en memoria por proceso | Usar caché/límites compartidos si se despliega en varias instancias; observar errores y latencia. Para una demo de archivo esto no exige añadir Redis ahora |

Evidencia principal: `web/src/app/api/fires/route.ts`, `web/src/lib/server-data.ts`, `web/src/hooks/use-dataset.ts` y `docs/API_CONTRACT.md`.

## Experiencia espacial y visualización

| Prioridad | Estado observado | Trabajo pendiente y criterio de cierre |
| --- | --- | --- |
| P0 | El navegador de revisión no dispone de WebGL; se verificó el render compatible | Revisar en el portátil real la escena Three.js, orientación de la textura, colocación de celdas, cámara, controles y desempeño. Docker no reemplaza esta comprobación |
| P1 | Se puede arrastrar el globo y abrir una celda al pulsarla; no hay exploración de focos por hover | Añadir inspección al mover el cursor si se conserva ese requisito; ofrecer equivalente por teclado/táctil |
| P1 | El raycaster de Three.js consulta los marcadores sin comprobar primero la oclusión por la esfera | Comprobar que una celda del hemisferio oculto no pueda seleccionarse al pulsar el planeta. Añadir prueba de visibilidad antes de selección |
| P1 | Hay respuesta al fallo inicial de WebGL, pero la pérdida posterior de contexto no detiene explícitamente el bucle Three.js | Probar recuperación y liberar/pausar el render anterior al activar la alternativa compatible |
| P1 | `useGeography()` silencia los errores al cargar límites | Mostrar un error y un reintento; distinguir límites aún cargando de límites que fallaron |
| P1 | Parte de la información secundaria usa tipografía muy pequeña | Medir legibilidad, contraste y reflujo con zoom, y ajustar al público objetivo |
| P1 | Selección, pestaña y semana están en estado de React y no en la URL | Permitir compartir un enlace a una región/semana y recuperar la selección tras recargar, si el recorrido del jurado lo necesita |
| P1 | La cobertura temporal se cuenta por índices semanales fijos | Mantener rótulos coherentes con el calendario. En esta revisión se corrigió que el último bin de Python abarca hasta el 31 de diciembre, incluidos años bisiestos |
| P2 | Órbitas y ondas son ilustrativas, no datos de trayectorias o propagación física | Mantener su carácter explícito; incorporar efemérides solo si aporta al problema y se pueden validar |

Evidencia principal: `web/src/components/globe.tsx`, `compatible-globe.tsx`, `terraecho.tsx`, `web/src/hooks/use-dataset.ts` y `web/src/app/globals.css`.

## Sonificación, accesibilidad y adecuación al reto

| Prioridad | Estado observado | Trabajo pendiente y criterio de cierre |
| --- | --- | --- |
| P0 | El estudio EIC trabaja un frame global de aerosoles de agosto de 2025; FIRMS representa otras semanas de Perú | Explicar la relación entre ambas pistas y sus límites. Si se busca un relato conjunto, seleccionar ventanas/regiones comparables. No afirmar causalidad por mostrarlas juntas |
| P0 | Los controles y el avance del audio se verificaron; la interpretación humana no | Probar con audífonos la distinción entre actividad típica, elevada, crítica y datos insuficientes; registrar qué entiende cada participante sin mirar la pantalla |
| P0 para afirmar inclusión validada | Hay voz del navegador, teclado, tabla, mapa alternativo y movimiento reducido | Hacer pruebas con personas ciegas o de baja visión y tecnologías de asistencia. Corregir hallazgos antes de describir la accesibilidad como universal o certificada |
| P1 | La voz depende de `speechSynthesis` y de las voces instaladas | Probar español en los navegadores de la presentación y conservar textos accesibles cuando no haya voz |
| P1 | El audio selecciona las 18 celdas de mayor FRP; las métricas muestran agregados completos | Mostrar qué celdas/porcentaje de la selección representan las voces o describir la reducción de forma perceptible; evaluar si oculta anomalías pequeñas importantes |
| P1 | No hay una comparación humana documentada entre mezcla web y WAV de referencia | Comparar mapeo, duración, intensidad y disonancia; ajustar balance y documentar las diferencias deliberadas |
| P1 | La información no depende solo del color, pero no hay auditoría formal de accesibilidad | Revisar flujo de foco, modales, nombres accesibles, sliders, avisos, contraste y zoom con NVDA/VoiceOver u otra tecnología pertinente |
| P1 | El EIC disponible es un frame y una partitura incluidos, no una búsqueda/API de frames | Añadir otras piezas o un catálogo si mejora la exploración; mantener fecha y atribución de cada una |
| P2 | No hay descarga de mezcla de audio ni comparación A/B guiada | Añadir solo si ayuda a explicar o compartir la ciencia; no es requisito para abrir la web |

Evidencia principal: `web/src/lib/audio.ts`, `web/src/components/eic-studio.tsx`, `dialog.tsx`, `terraecho.tsx` y `scripts/listening_test.py`.

## Entrega, equipo y despliegue

| Prioridad | Estado observado | Trabajo pendiente y criterio de cierre |
| --- | --- | --- |
| P0 para una demo remota | No se ha desplegado una versión pública | Desplegar, verificar HTTPS y probar los flujos y archivos desde el enlace que recibirá el jurado |
| P0 | `main` y `develop` ya existen, pero la web permanece en la PR #1 | Revisar e integrar la PR a `develop`; preparar una entrega de `develop` a `main`. No confundir creación de ramas con integración |
| P1 | La rama predeterminada sigue siendo `data-pipeline`; las ramas nuevas no están protegidas | La propietaria con permisos de administración debe establecer la política de rama predeterminada, PR y comprobaciones |
| P1 | CI ejecuta contrato, TypeScript y build; no hay una suite E2E versionada del navegador | Añadir una prueba de flujo que atraviese selección, mapa, tabla, error de API y EIC. Mantener comprobación manual de audibilidad y tecnologías de asistencia |
| P1 | No hay un archivo de licencia de software | Acordar con el equipo una licencia para su código y revisar por separado las condiciones de datos, imágenes y otros activos |
| P1 | Los CSV originales, manifiestos y grandes resultados no tienen una estrategia de publicación completa | Definir almacenamiento/versionado de datos y evitar que crezcan indefinidamente dentro del historial Git |
| P1 | La documentación de despliegue existe, pero no se ha probado un proyecto real de hosting | Verificar variables privadas, archivos empaquetados, ruta API, caché, recuperación y construcción desde un clon limpio |
| P1 | La evidencia de escritorio y móvil existe, pero no cubre dispositivos físicos | Probar el equipo exacto, navegador, audio, proyector y ancho móvil que se usarán; preparar alternativa local si falla Internet |
| P2 | No hay Dockerfile ni Compose | Containerizar cuando la política del equipo o el servicio Python lo justifiquen. No bloquea desarrollo ni hosting Next.js |
| P2 | No existen cuentas, roles, base de datos, PWA o notificaciones push | Decidir si pertenecen al alcance. Ninguna de esas funciones es necesaria por sí sola para demostrar sonificación EIC |

## Orden de trabajo propuesto

1. Abrir la rama web en el equipo y comprobar Tierra, audio, filtros, fechas y EIC.
2. Corregir recorte/procedencia/cobertura y regenerar un conjunto científico defendible.
3. Conectar FIRMS con una clave real y decidir si la demo mostrará archivo, modo reciente o ambos.
4. Probar la comprensión del sonido y la navegación accesible con participantes; cerrar la explicación EIC/Perú.
5. Probar WebGL en el equipo real y desplegar una versión identificable para el jurado.
6. Integrar a `develop` y preparar la entrega a `main`; expandir históricos, servicio Python y automatización en paralelo según el alcance.

Los carriles de datos, interfaz/visualización, sonido/accesibilidad y entrega pueden avanzar por separado usando las partituras existentes como contrato. El diseño espacial ya es demostrable; las prioridades anteriores buscan que el contenido científico, la inclusión y la entrega sean igualmente comprobables.
