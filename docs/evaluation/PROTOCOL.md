# Evaluación pendiente con personas

Este paquete permite ejecutar un piloto; **no contiene participantes, consentimiento obtenido ni resultados humanos**. Las comprobaciones automáticas no acreditan accesibilidad universal, comprensión ni confort.

## Preparación y consentimiento

Proponer 5–8 personas, procurando 2–3 ciegas o con baja visión. Es un piloto formativo propuesto, no una exigencia NASA ni un tamaño que demuestre eficacia estadística. Permitir el equipo y lector habitual de cada persona. No sustituir su participación por personas videntes con ojos cerrados.

Leer: «Queremos comprobar si los controles y sonidos ayudan a explorar una imagen NASA. Participar es voluntario; puedes parar, bajar el volumen o saltar cualquier tarea. No evaluamos tu capacidad. Registraremos respuestas, tiempo y barreras bajo un código. No necesitamos nombre, diagnóstico ni dirección. No grabaremos tu voz ni pantalla sin un consentimiento separado. ¿Aceptas participar y ese registro?». Registrar `consent=yes` solamente después de aceptar. Acordar plazo de conservación y quién accede antes de recoger datos. Guardar respuestas fuera del repositorio público.

## Tareas y orden

1. Sin reproducción automática, localizar la guía EIC, escoger una pieza, iniciar, pausar y ajustar volumen. Registrar autonomía, asistencia, foco y barreras.
2. EIC global, aislar carbono negro y comparar los segmentos 20 y 70, conservando volumen y timbre. Preguntar cuál tiene mayor **presencia visual extraída**, no concentración atmosférica. La clave se obtiene del JSON versionado antes de la sesión. Contrabalancear el orden A/B entre participantes.
3. EIC: distinguir una voz aislada de la mezcla, leer sus rasgos, activar mono y volver a estéreo. Preguntar qué representa tono y qué representa ganancia. No convertir «más fuerte» en respuesta correcta de anomalía FIRMS.
4. Archivo: año 2024, semana que empieza 16-sep, Amazonas y San Martín. Preguntar cuál tiene mayor anomalía estadística y explicar el dato. Clave actual: Amazonas z=2.53 y San Martín z=1.53. No preguntar cuál tiene más incendios individuales.
5. Archivo: año 2012, primer intervalo. Identificar datos insuficientes y distinguirlo de pausa o cero detecciones. Abrir una celda por teclado y detenerla.
6. Compartir una selección EIC y recargarla. Verificar pieza, segmento, voces y mono; comprobar fuente y fecha. Abrir/cerrar diálogo con teclado y devolver foco.

Separar EIC y FIRMS en el registro. Intercalar el orden de los dos modos. Máximo propuesto: 60 s por tarea de navegación y 90 s por comparación; detener antes si lo solicita. Registrar el tiempo efectivo, sin imputar éxitos a tareas abandonadas.

## Registro y análisis

Copiar `pilot-responses-template.csv` a un archivo privado. ID anónimo, tarea, orden, completada, correcta cuando corresponda, segundos, asistencia, comodidad 1–5 y barrera textual. No rellenar muestras ficticias. Ejecutar `python scripts/summarize_pilot.py /ruta/privada/respuestas.csv`; el script rechaza un archivo vacío. Reportar n real, intentos, numeradores/denominadores, mediana de tiempo y comodidad por modo; un piloto pequeño no permite generalizar a todas las personas con discapacidad visual.

Registrar una incidencia por barrera, corrección, commit y comprobación posterior. Consentir y repetir solo lo necesario. Conservar resultados agregados anonimizados; no publicar datos sensibles en GitHub.

## Máscaras EIC

`eic-mask-annotation-template.csv` ofrece 40 puntos para una revisión independiente. Registrar capa o fondo/ambiguo mirando imagen y leyenda; dos revisores si es posible. No usar la propia máscara como verdad de referencia. Calcular desacuerdos y confusiones solo después de etiquetar. Las cuatro muestras de leyenda que pasan tests son calibración de color, **no precisión global**. Colores del terreno, océano y superposición siguen siendo limitaciones.

## Dispositivos y rendimiento

Comprobar NVDA/Firefox o Chrome en Windows y VoiceOver/Safari cuando estén disponibles. Registrar versiones reales, equipo, zoom 200/400 %, 320/390 CSS px y orientación. El navegador de revisión no dispone de WebGL acelerado: la alternativa se ha probado; quedan textura, oclusión, tacto, consumo y sincronización mientras orbita en GPU real. Registrar barreras sin declarar conformidad WCAG completa a partir de axe.

## Audio y comparación de renderizadores

`node --import tsx web/scripts/export-reference.mts` produce tres WAV originales con la misma función que el Worker del navegador, metadata de fuente y checks de picos. EIC directo usa AudioContext, envolvente, PeriodicWave normalizado, compresor y volumen de usuario; el WAV usa suma armónica, fundidos y tanh. Comparten notas, rasgos, capas y barrido, pero no son idénticos acústicamente. Comparar timbre/balance y confort en el piloto antes de afirmar equivalencia perceptual. No copiar la banda sonora de un vídeo NASA.
