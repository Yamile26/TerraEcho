# TerraEcho en Windows, ramas y conexión de datos

## Primera ejecución: Node.js y npm

Para abrir la web se necesitan Git y Node.js 22 o posterior con npm. El pipeline de Python ya generó los JSON incluidos. No hace falta ejecutar Python, descargar nuevamente los archivos NASA ni configurar una clave para este primer arranque.

Abre PowerShell en la carpeta donde guardas tus proyectos. Comprueba las herramientas:

```powershell
git --version
node --version
npm.cmd --version
```

Si todavía no tienes una copia de TerraEcho:

```powershell
git clone --branch feat/terraecho-web-experience https://github.com/Yamile26/TerraEcho.git
Set-Location .\TerraEcho
npm.cmd ci
npm.cmd run dev
```

Abre `http://localhost:3000`. Mantén esa terminal abierta. Para detener la web, pulsa `Ctrl+C`.

`npm.cmd` usa el ejecutable de npm para Windows. También puedes usar `npm` si tu configuración de PowerShell permite su script. En WSL/Linux utiliza `npm`.

## Si el repositorio ya está clonado

En PowerShell, entra a la carpeta que contiene `.git` y `package.json`:

```powershell
git status
git fetch origin
git switch feat/terraecho-web-experience
git pull --ff-only origin feat/terraecho-web-experience
npm.cmd ci
npm.cmd run dev
```

`git switch` detecta la rama remota si todavía no existe localmente. Si `git status` muestra trabajo propio pendiente, guárdalo en tu rama antes de cambiar. No se requiere `reset --hard`, borrar carpetas de trabajo ni forzar el pull.

Si el puerto 3000 ya está ocupado:

```powershell
npm.cmd run dev -- --port 3001
```

En ese caso abre `http://localhost:3001`. Ejecuta los comandos desde la raíz `TerraEcho`, no desde `terraecho/`, que contiene los módulos Python.

## Qué hace el arranque

1. `web/scripts/prepare-data.mjs` copia los JSON y la imagen EIC existentes a las carpetas públicas de la aplicación.
2. Next.js inicia la web y sus endpoints.
3. El navegador solicita la partitura del año a `/api/fires?year=2026`.
4. El servidor devuelve el archivo preparado. El navegador usa sus métricas para el globo, el observatorio y Web Audio.

Las carpetas generadas están ignoradas por Git: no necesitas crearlas a mano ni subir duplicados de los archivos científicos. La imagen EIC también es local. Las tipografías intentan cargarse desde Google Fonts y tienen alternativas del sistema.

El frontend no vuelve a ejecutar Python al cambiar de región o semana. Para actualizar el archivo histórico, el carril de datos debe regenerar las partituras con su baseline completo y validado, publicar los resultados en `data/scores/` y reiniciar el servidor de desarrollo o reconstruir la entrega. El generador Python usa `out/` por defecto: un archivo nuevo allí no reemplaza automáticamente los que consume la web.

## Docker: decisión para este proyecto

**Recomendación actual: usa Node.js y npm para desarrollar la interfaz.** Hay una aplicación Next.js; todavía no hay un servicio Python HTTP ni una base de datos que deban arrancar juntos. Docker no es un requisito para que funcione la web ni para desplegarla en un proveedor compatible con Next.js.

| Opción | Cuándo conviene | Estado actual |
| --- | --- | --- |
| Node.js + npm | Trabajar en React, Three.js, estilos y sonido con cambios rápidos | Disponible y verificada |
| Docker para la web | Estandarizar un entorno o desplegar en un host de contenedores | No se añadió Dockerfile ni Compose |
| Docker Compose para web + procesador | Ejecutar juntos Next.js y un servicio Python cuando este exista | Arquitectura futura; no hay un procesador HTTP que arrancar todavía |

No ejecutes `docker compose up` en este estado: el repositorio no tiene una configuración Compose. Tampoco hace falta añadir PostgreSQL, Redis o autenticación para abrir esta versión. La [guía oficial de Next.js con Docker](https://docs.docker.com/guides/nextjs/) sirve de referencia cuando se decida containerizar.

Docker ejecutaría el servidor; Three.js y Web Audio seguirían ejecutándose en el navegador. Por tanto, Docker no habilita WebGL si el navegador o el dispositivo lo tienen desactivado.

## Ramas remotas creadas

| Rama | Contenido en este punto | Uso |
| --- | --- | --- |
| `main` | Base científica original, desde `979b6ed` | Base estable para futuras entregas |
| `develop` | La misma base, hasta integrar la PR de la web | Integración del equipo |
| `feat/terraecho-web-experience` | Aplicación web, ciencia existente, documentación y pruebas | Rama para probar la web ahora |
| `data-pipeline` | Rama original conservada | Trabajo científico existente |

La [PR #1](https://github.com/Yamile26/TerraEcho/pull/1) propone integrar `feat/terraecho-web-experience` en `develop`. Continúa como borrador. Crear `main` y `develop` no integra automáticamente los cambios de esa PR; por eso el comando de clonación selecciona explícitamente la rama de la web.

Flujo propuesto: cada cambio se desarrolla en una rama de funcionalidad, se integra mediante PR a `develop`, y una entrega revisada pasa mediante otra PR de `develop` a `main`. Mientras la PR inicial siga abierta, una funcionalidad que dependa de la web puede partir de la rama de la web; después de su integración, debe partir de `develop`.

Para consultar las ramas remotas:

```powershell
git fetch origin
git branch -a
```

Para crear sus referencias locales, si todavía no existen:

```powershell
git branch --track main origin/main
git branch --track develop origin/develop
```

La rama predeterminada de GitHub sigue siendo `data-pipeline`. Cambiarla a `main` y proteger las ramas requiere permisos de administración, que la conexión usada no tiene. La propietaria puede hacerlo en **Settings → Default branch** y configurar las reglas de PR y comprobaciones. [Referencia de GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch).

## Configurar FIRMS cuando la web ya abra

Desde la raíz del repositorio, crea el archivo local solo si no existe:

```powershell
if (-not (Test-Path .\web\.env.local)) {
    Copy-Item .\web\.env.example .\web\.env.local
}
notepad .\web\.env.local
```

Contenido:

```dotenv
FIRMS_MAP_KEY=TU_CLAVE_DE_FIRMS
TERRAECHO_PYTHON_API_URL=
```

Obtén tu propia clave mediante la [página oficial FIRMS MAP_KEY](https://firms.modaps.eosdis.nasa.gov/api/map_key/). No la compartas en chats, commits o capturas. El archivo `.env.local` está ignorado por Git. Deja la URL Python vacía mientras no exista ese servicio.

Reinicia `npm.cmd run dev` después de guardar las variables. Abre:

- `http://localhost:3000/api/health`: debe indicar si la clave está configurada. Ese indicador no verifica que la clave sea válida.
- `http://localhost:3000/api/fires?year=2026`: devuelve la partitura histórica.
- `http://localhost:3000/api/fires?mode=live&days=1`: intenta consultar detecciones recientes a NASA; esta sí es una comprobación del proveedor.

También puedes usar **Fuentes y conexión API → Comprobar conexión API** dentro de la web.

La [API oficial de área de FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) admite consultas de 1 a 5 días por solicitud. En TerraEcho el servidor limita además el producto y la caja geográfica. **Poner la clave no sustituye el archivo histórico del globo por datos recientes:** falta implementar ese modo visual y procesar sus métricas.

## Cómo se conecta cada fuente

| Fuente | Flujo implementado | Qué falta |
| --- | --- | --- |
| FIRMS histórico | CSV descargado → Python por lotes → JSON del repositorio → API Next.js → visualización y sonido | Corregir recorte nacional, trazabilidad y exportar todos los años del alcance |
| FIRMS reciente | Navegador → endpoint Next.js → NASA con clave privada → detecciones JSON | Validar la conexión con una clave real, integrar estas observaciones en la interfaz y calcular métricas coherentes |
| EIC | Imagen NASA incluida → partitura Python incluida → barrido de la imagen y síntesis en el navegador | Una selección ampliada de frames y un relato conectado espacial/temporalmente con Perú |
| Servicio Python futuro | Next.js tiene un adaptador para `GET /v1/scores/{year}` | Crear, ejecutar, probar y desplegar el servicio |

La clave se usa entre el servidor Next.js y NASA. El navegador no necesita conocerla. Para el servicio Python futuro, Next.js hará la petición HTTP desde el servidor; no es una llamada directa del navegador al procesador.

Si más adelante el servicio Python funciona en tu equipo en el puerto 8000 y cumple el contrato, se podrá configurar `TERRAECHO_PYTHON_API_URL=http://127.0.0.1:8000/`. No actives ese valor antes de tener el servicio: cambiaría el proveedor de partituras y la web mostraría un error si no responde.

## Verificar una entrega

En otra terminal, desde la raíz:

```powershell
npm.cmd run test:web
npm.cmd run typecheck
npm.cmd run build
```

Para probar el servidor de producción local, detén antes el servidor de desarrollo y ejecuta `npm.cmd start`. Esto no publica la web en Internet. El [despliegue](DEPLOYMENT.md) y el [inventario de pendientes](PENDIENTES_WEB.md) están documentados por separado.
