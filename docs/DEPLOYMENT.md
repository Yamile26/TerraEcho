# Arranque y despliegue

## Local Ubuntu / WSL

```bash
cd ~/projects/TerraEcho
git fetch origin
git switch feat/terraecho-recovery
git pull --ff-only origin feat/terraecho-recovery
npm ci
[ -f web/.env.local ] || cp web/.env.example web/.env.local
nano web/.env.local
npm run dev
```

En Ubuntu se usa `npm`, no `npm.cmd`. Mantener Node y npm instalados dentro de WSL; el proyecto está bajo `~/projects`, no hace falta moverlo a Windows. La configuración válida es `FIRMS_MAP_KEY=...` solo en `web/.env.local`. No compartir la clave. Dejar `TERRAECHO_PYTHON_API_URL=` vacío mientras no exista ese servicio. Reiniciar tras cambiar variables. Docker no es obligatorio.

## Web completa con servidor

La publicación principal usa ahora un Worker con la misma interfaz Next exportada y el mismo proveedor FIRMS TypeScript. `npm run build` genera un ES module autocontenido con los activos comprimidos; `.openai/hosting.json` mantiene el identificador/audiencia existentes y declara `DB` para el presupuesto global. La migración versionada crea una sola fila de cuota, sin almacenar claves ni observaciones. Una sentencia UPSERT atómica admite diez consultas por minuto entre instancias; si falta la base o falla, la API reciente no llama a NASA. EIC y archivo siguen disponibles.

Configurar `FIRMS_MAP_KEY` como secreto de ejecución del servicio de publicación. No se incorpora al build, los activos, la cuota ni las respuestas. Verificar `/api/health` y ejecutar el comprobador contra el origen HTTPS publicado. La API conserva las diferencias entre NOAA-20/21 y el archivo histórico, sin anomalías recientes inventadas.

La [publicación completa HTTPS](https://terraecho-earth-jukebox.dotingchime4.chatgpt.site) está comprobada hasta la versión 6, fuente `e5a3e637642e727f9e17898b88040c0017c60618`; `recovery-final-check.json` registra la comprobación final y la adquisición EIC nueva. La versión 5 conserva la comprobación detallada del recorrido reciente. `public-https-check.json` registra bytes originales de HTML, imagen NASA, catálogo EIC y snapshots 2012/2025; `firms-host-check.json` registra la API y `recent-browser-check.json` el recorrido real de mapa, tabla y audio. Los activos quedan comprimidos dentro del bundle; el handler los decodifica antes de responder para que la pasarela controle la compresión de transporte. Esto corrige la recarga que mostraba bytes gzip en la versión 3.

La alternativa Node/Next existente se construye con `npm run build:node` y se ejecuta con `npm start`:

```bash
npm run test:web
npm run typecheck
npm run build:node
npm start
```

Necesita Node 22+, dependencias, `.next` y `web/public`. No es un sitio puramente estático porque `/api/fires` consulta NASA con clave privada. Configurar la clave como secreto del host en ejecución, nunca en Git ni un argumento del build. Para Vercel, importar este repositorio y rama, raíz `web`, framework Next.js, build `npm run build`, lock de npm en raíz e incluir archivos fuera de `web` durante el build para preparar `data/`. Si exige instalación explícita desde `web`, usar `cd .. && npm ci`. Verificar logs de preparación y `/api/health`. No se ha conectado ni validado una cuenta Vercel en este trabajo.

## Demo EIC/archivo independiente

El generador estático se conserva como alternativa independiente. La URL principal ya sirve la aplicación completa con servidor. `docs/evaluation/public-demo-check.json` conserva la comprobación histórica de la primera edición estática y su exportación WAV; no describe el alcance actual del host.

```bash
node web/scripts/build-archive-demo.mjs
```

Genera `dist/` a partir de la misma aplicación Next mediante una copia temporal saneada, excluyendo `.env`, API y QA. No cambia el código del servidor completo. Usa snapshots estáticos, incluye imágenes, audio sintetizado y exportación WAV; la sección reciente explica que requiere servidor. Ese resultado no reemplaza el artefacto Worker de la publicación principal. No guardar una clave allí ni anunciar API reciente activa en esa edición.

## Cierre de publicación

1. CI: contratos Python, huellas de los 14 archivos SP, tests web, tipos y build limpio.
2. `/api/health`: presencia de variable, sin secretos. No es una prueba NASA.
3. Contra el origen publicado o Node local, ejecutar `node web/scripts/check-live.mjs http://localhost:3000` para consultar NOAA-20, ventana explícita, y guardar HTTP/producto/fecha/conteo sin clave en `out/firms-connection.json`. Usar el origen raíz sin ruta, credenciales, parámetros ni fragmento. El comando solo termina con código 0 si `responseValid` es `true`: comprueba producto, modo, fechas, ámbito, observaciones, FRP desconocida, disponibilidad y reconciliación de conteos. Un HTTP 200 con JSON incompleto, HTML estático o un snapshot termina con código 1 y no se registra como consulta válida. `serverRetrievedAt` distingue adquisición del servidor de la hora de comprobación. Los errores se limitan a códigos conocidos; no se copia texto del proveedor. Un 200 vacío válido no prueba ausencia de fuego. SNPP no tiene datos nuevos después del 2-nov-2026.
4. EIC: cambiar pieza/capa, pausa/seek, mono, WAV y recargar enlace compartido.
5. Archivo: 2012 gap inicial, 2024 caso contextual, 2025 y aviso del legado 2026.
6. WebGL en dispositivo real, alternativa 2D, teclado/lector y móvil. Las pruebas del navegador de revisión usaron render compatible.
7. Publicar el artefacto completo de un commit comprobado; nunca reemplazar producción con resultados parciales de un lote fallido.

## Actualización por lotes y rollback

Los visitantes solo leen exports. Un cambio de fuentes entra en rama, con manifiesto nuevo auditado, reproducción, QA y checks antes de integrar/publicar. `reproduce_release.py` comprueba las descargas antes de lanzar la reconstrucción; un CSV con bytes distintos falla. El generador escribe cada JSON temporalmente antes de renombrar, pero eso **no** constituye una transacción de todo el directorio. La unidad atómica de publicación es el artefacto/versión del sitio completo, después de CI. Conservar la versión previa y volver a ella si falla una comprobación. No hay cron activo ni actualización automática prometida.

## Ramas

`feat/terraecho-web-experience` → PR a `develop`; probar la integración antes de promover `develop` a `main`. No borrar ramas ajenas ni sobrescribir historia. Las decisiones de protección/merge y la publicación de `main` corresponden al flujo del equipo. La demo puede conservar el commit de entrega aunque luego continúe el desarrollo. WAV y build local sirven como alternativa si falla Internet.
