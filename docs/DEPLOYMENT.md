# Arranque y despliegue

## Local Ubuntu / WSL

```bash
cd ~/projects/TerraEcho
git fetch origin
git switch feat/terraecho-web-experience
git pull --ff-only origin feat/terraecho-web-experience
npm ci
[ -f web/.env.local ] || cp web/.env.example web/.env.local
nano web/.env.local
npm run dev
```

En Ubuntu se usa `npm`, no `npm.cmd`. Mantener Node y npm instalados dentro de WSL; el proyecto está bajo `~/projects`, no hace falta moverlo a Windows. La configuración válida es `FIRMS_MAP_KEY=...` solo en `web/.env.local`. No compartir la clave. Dejar `TERRAECHO_PYTHON_API_URL=` vacío mientras no exista ese servicio. Reiniciar tras cambiar variables. Docker no es obligatorio.

## Web completa con servidor

```bash
npm run test:web
npm run typecheck
npm run build
npm start
```

Necesita Node 22+, dependencias, `.next` y `web/public`. No es un sitio puramente estático porque `/api/fires` consulta NASA con clave privada. Configurar la clave como secreto del host en ejecución, nunca en Git ni un argumento del build. Para Vercel, importar este repositorio y rama, raíz `web`, framework Next.js, build `npm run build`, lock de npm en raíz e incluir archivos fuera de `web` durante el build para preparar `data/`. Si exige instalación explícita desde `web`, usar `cd .. && npm ci`. Verificar logs de preparación y `/api/health`. No se ha conectado ni validado una cuenta Vercel en este trabajo.

## Demo EIC/archivo independiente

```bash
node web/scripts/build-archive-demo.mjs
```

Genera `dist/` a partir de la misma aplicación Next mediante una copia temporal saneada, excluyendo `.env`, API y QA. No cambia el código del servidor completo. Usa snapshots estáticos, incluye imágenes, audio sintetizado y exportación WAV; la sección reciente explica que requiere servidor. `.openai/hosting.json` identifica el hosting de esa demo. No guardar una clave allí ni anunciar API reciente activa en esa edición.

## Cierre de publicación

1. CI: contratos Python, huellas de los 14 archivos SP, tests web, tipos y build limpio.
2. `/api/health`: presencia de variable, sin secretos. No es una prueba NASA.
3. En host Node, ejecutar `node web/scripts/check-live.mjs http://localhost:3000` para consultar NOAA-20, ventana explícita, y guardar HTTP/producto/fecha/conteo sin clave en `out/firms-connection.json`. Un 200 vacío no prueba ausencia de fuego. SNPP no tiene datos nuevos después del 2-nov-2026.
4. EIC: cambiar pieza/capa, pausa/seek, mono, WAV y recargar enlace compartido.
5. Archivo: 2012 gap inicial, 2024 caso contextual, 2025 y aviso del legado 2026.
6. WebGL en dispositivo real, alternativa 2D, teclado/lector y móvil. Las pruebas del navegador de revisión usaron render compatible.
7. Publicar el artefacto completo de un commit comprobado; nunca reemplazar producción con resultados parciales de un lote fallido.

## Actualización por lotes y rollback

Los visitantes solo leen exports. Un cambio de fuentes entra en rama, con manifiesto nuevo auditado, reproducción, QA y checks antes de integrar/publicar. `reproduce_release.py` comprueba las descargas antes de lanzar la reconstrucción; un CSV con bytes distintos falla. El generador escribe cada JSON temporalmente antes de renombrar, pero eso **no** constituye una transacción de todo el directorio. La unidad atómica de publicación es el artefacto/versión del sitio completo, después de CI. Conservar la versión previa y volver a ella si falla una comprobación. No hay cron activo ni actualización automática prometida.

## Ramas

`feat/terraecho-web-experience` → PR a `develop`; probar la integración antes de promover `develop` a `main`. No borrar ramas ajenas ni sobrescribir historia. Las decisiones de protección/merge y la publicación de `main` corresponden al flujo del equipo. La demo puede conservar el commit de entrega aunque luego continúe el desarrollo. WAV y build local sirven como alternativa si falla Internet.
