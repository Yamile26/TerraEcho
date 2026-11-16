# TerraEcho — NASA Space Apps 2026

Trabajar sobre una rama de desarrollo. Preservar el historial, las ramas y el trabajo existente del equipo.

## Una tarea por vez

1. Consultar `docs/evaluation/task-status.json`, sus dependencias y la implementación existente antes de elegir una tarea.
2. Implementar solo esa tarea y actualizar su evidencia sin declarar comprobaciones no realizadas.
3. Ejecutar las pruebas y verificaciones correspondientes; corregir los fallos antes de guardar la tarea.
4. Usar `git add` con rutas explícitas y un commit descriptivo con Conventional Commits.
5. Hacer push inmediatamente y comprobar el SHA y el contenido en GitHub antes de comenzar otra tarea. Nunca acumular tareas para un push final.
6. Si la terminal carece de autenticación, usar la conexión autorizada de GitHub para guardar un único commit equivalente, verificar su árbol y avance normal de la rama, y explicar esa limitación. No afirmar que `git push` funcionó si falló.
7. Si cambia la rama remota, inspeccionar los nuevos commits antes de reintentar. No sobrescribir cambios ajenos, no usar force push, no reescribir el historial publicado ni duplicar implementaciones.

## Protección y evidencia

- No subir claves API, tokens, credenciales, archivos `.env` ni respuestas identificables de participantes. Las plantillas `.env.example` solo contienen valores vacíos o marcadores.
- Mantener la clave FIRMS exclusivamente en el servidor. Nunca usar `NEXT_PUBLIC_` para secretos.
- Antes de recuperar o integrar trabajo, inspeccionar estado, ramas, commits, reflog y cambios locales; conservar una copia antes de modificar un entorno anterior.
- No atribuir datos sintéticos a NASA, ni confundir pruebas automatizadas con validación humana, despliegue completo o envío oficial.
- Actualizar `task-status.json` y regenerar `docs/ESTADO_53_TAREAS.md` con `python scripts/render_task_status.py` al cambiar el estado de una tarea.
- Leer también `web/AGENTS.md` antes de modificar código web.

## Referencia visual del proyecto

- La interfaz usa la paleta azul marino y turquesa de `docs/design/terraecho-reference-navy-cyan.png`, documentada en `docs/THEME.md`. Conservarla en todas las vistas.
- `web/src/lib/theme.ts` es la fuente compartida de tokens; CSS, Three.js, Canvas y SVG deben consumirla. Los estados desactivados también usan estos tokens.
- La referencia no es verde claro. Una modificación del tema debe corresponder a una nueva instrucción explícita de la usuaria. Los colores de fuentes científicas conservan su significado propio.
