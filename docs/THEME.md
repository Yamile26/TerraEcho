# Paleta visual de TerraEcho

La referencia es la captura compartida por el equipo el 16 de noviembre de 2026: fondo casi negro, paneles azul marino y controles turquesa. No se recibió un archivo o nodo de Figma con especificaciones; esta implementación toma la captura como referencia visual.

| Uso                  | Color     |
| -------------------- | --------- |
| Fondo                | `#040810` |
| Paneles              | `#0A1623` |
| Campos y controles   | `#0B1C2A` |
| Bordes               | `#1D3548` |
| Texto principal      | `#E3EDF7` |
| Texto secundario     | `#8CA4B7` |
| Acento turquesa      | `#53E7DE` |
| Resplandor del globo | `#42B8FF` |
| Actividad elevada    | `#FFAD66` |
| Anomalía crítica     | `#FF6172` |

`web/src/lib/theme.ts` es la fuente compartida de colores. El layout del servidor publica sus valores como variables CSS; Three.js, Canvas 2D y los gráficos SVG importan la misma paleta. Cambiar un token actualiza esos consumidores sin duplicar valores en cada componente.

La composición usa navegación superior, selección geográfica junto al globo, métricas a la derecha y tarjetas inferiores para la línea de tiempo y la sonificación. En móvil, las tarjetas se apilan. El observatorio y el estudio EIC crecen con su contenido y usan el desplazamiento de la página.

Los niveles habitual, elevado y crítico conservan etiquetas además del color. La imagen científica de aerosoles EIC y la leyenda de sus cuatro capas conservan su codificación original: sus colores representan sustancias y no son colores de interfaz. La modificación visual no altera los conteos, anomalías, archivos de origen ni parámetros de síntesis.

Las capturas de revisión de esta paleta están en `docs/screenshots/terraecho-palette-*.jpg`. El navegador de revisión utiliza la esfera compatible por no disponer de WebGL; la escena acelerada requiere una comprobación visual adicional en un dispositivo con WebGL.
