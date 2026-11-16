# Decisiones técnicas y condiciones para ampliarlas

| Decisión | Motivo en este desafío | Evidencia / límite |
| --- | --- | --- |
| EIC primero | El reto exige imagen→sonido; FIRMS solo no lo cubre | Acceso directo, tres lecturas de un mismo frame, tabla de rasgos |
| Reglas HSV por capa | Método interpretable, sin entrenamiento y reproducible | Calibración de cuatro muestras de leyenda; confusión global pendiente |
| No usar ML ahora | No hay etiquetas independientes ni mejora medida que justifique el costo | Añadir solo frente a error documentado, conjunto de evaluación y mejora reproducible |
| Coordenadas de imagen | Una proyección renderizada no permite inferir latitud con una regla lineal sin validar | Altura→tono declarada visual; crop no se llama Perú exacto |
| Clipping por punto original | Mantiene el mismo denominador en totales regionales y nacionales | 960,333 registros retenidos; reconciliación en todos los bins válidos |
| Cohorte SP de un sensor | Evita introducir cambio de producto como cambio del fenómeno | 2012–2025 Suomi NPP; NRT reciente separado; 2026 legado explícito |
| Referencia 2012–2024 fija | Explicación y repetición de la comparación retrospectiva | Objetivo excluido, sin 2026; no pronóstico; sensibilidad publicada |
| Máscara de gaps NASA | Cero detecciones no demuestra falla de producto | Gaps declarados antes del suavizado; nubes/pasadas no certificadas |
| JSON/gzip sin BD | Datos de lectura por lotes; equipo puede trabajar en paralelo | Huellas y contratos; una BD se justificaría por consultas/adiciones que estos archivos no resuelvan |
| Proxy Next.js | Guarda clave y aplica controles junto a la web | No requiere segundo servicio para reenviar una consulta |
| Python por lotes | Cómputo científico reproducible fuera del hilo/visita | Separar FastAPI solo si una operación interactiva medible exige cómputo remoto |
| AudioContext + Worker | Tiempo musical estable; exportación fuera del hilo de interacción | Reloj y buffers probados; GPU+audio simultáneos en equipo real pendiente |
| 18 voces + detalle | Evita mezclar cientos de fuentes, muestra pérdida de representación | Conteo/FRP visibles; no se demuestra aún el mejor límite perceptual |
| Sin Docker obligatorio | Desarrollo web funciona con Node; no hay varios procesos locales que coordinar | Si el host exige contenedor, empaquetar build validado; no añadirlo como requisito del reto |
| Sin Redis/colas | No se ha medido tráfico distribuido ni trabajo interactivo pesado | Añadir límite/caché compartidos antes de prometer cuota global en varias instancias |
| Demo estática separada | EIC y archivo se pueden demostrar aunque no haya backend o clave | No contiene ni simula la API reciente; versión Next completa conserva esa función |

Registro de responsable: cada carril debe asignar a una persona real antes del cierre del equipo. Autoría y licencia del trabajo original requieren su aprobación; la asistencia de IA se declara en la entrega.

## Backend de la publicación completa

El hosting existente ejecuta Workers en vez de un proceso Node persistente. El adaptador de publicación reutiliza el proveedor FIRMS, contratos, límites territoriales y la UI exportada de Next; la alternativa Node se conserva en `build:node`. Los archivos de ciencia continúan versionados como JSON/gzip. La única tabla D1 implementa un presupuesto compartido de diez consultas por minuto mediante UPSERT atómico: resuelve el requisito de cuota entre instancias, no sustituye el archivo científico ni guarda secretos. La migración se aplica antes de publicar; las peticiones nunca crean tablas.

Los activos están comprimidos e incluidos en el ES module para conservar los mismos hashes y una publicación completa. Una caída de NASA o del presupuesto no bloquea EIC/archivo. El cambio se verifica con pruebas de contrato, SQL real, dos instancias de handler y comprobación de los bytes de la imagen NASA.
