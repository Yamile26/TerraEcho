# Paleta visual de TerraEcho

La referencia de Figma aportada muestra fondos oscuros verdosos, verde claro en la acción principal y coral para anomalía crítica. La captura azul/turquesa corresponde al aspecto que el equipo quería corregir. No hay enlace a un nodo Figma verificable en esta conversación; se trabaja desde las capturas, sin afirmar coincidencia exacta de medidas.

| Uso | Color |
| --- | --- |
| Fondo | `#0A1215` |
| Panel | `#121E21` |
| Panel elevado | `#192A2A` |
| Campo | `#1B2A29` |
| Borde | `#2B3C3A` |
| Texto | `#ECF0E9` |
| Texto secundario | `#B8C4BF` |
| Acento verde claro | `#C5ECA3` |
| Actividad elevada | `#E9CB77` |
| Crítica | `#FF835B` |

`web/src/lib/theme.ts` alimenta CSS, Three.js, Canvas y SVG. La textura Tierra y la leyenda EIC tienen su codificación propia. Cambiar una sustancia a verde por estética rompería la traducción científica: se conserva la imagen fuente y sus cuatro colores.

La composición conserva globo, región, métricas laterales, línea de tiempo y estudio de sonido. EIC añade acceso directo, catálogo, rasgos y exportación. Móvil apila las secciones. Las capturas `terraecho-release-*.jpg` corresponden a esta revisión; capturas anteriores son evidencia histórica, no el aspecto final.

El navegador de revisión carece de WebGL acelerado; la esfera compatible está revisada. La comprobación GPU real queda indicada en el registro de tareas.
