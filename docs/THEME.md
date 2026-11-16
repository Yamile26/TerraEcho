# Paleta visual de TerraEcho

La referencia confirmada por la usuaria es la [captura azul marino y turquesa](design/terraecho-reference-navy-cyan.png). Fondo casi negro azulado, paneles azul marino, controles turquesa y resplandor azul. Se restaura la paleta guardada en `da3a282`, que correspondía a esa referencia. La interpretación verde introducida en `033f30f` fue un error; no representa la instrucción de la usuaria.

| Uso | Token | Color |
| --- | --- | --- |
| Fondo | `bg` | `#040810` |
| Panel | `panel` | `#0A1623` |
| Panel elevado | `panelRaised` | `#0D2030` |
| Campo | `input` | `#0B1C2A` |
| Borde | `line` | `#1D3548` |
| Borde destacado | `lineStrong` | `#2B4B60` |
| Texto principal | `text` | `#E3EDF7` |
| Texto secundario | `secondary` | `#B6C8D8` |
| Texto auxiliar | `muted` | `#8CA4B7` |
| Detalle discreto | `subtle` | `#69859C` |
| Acento turquesa | `accent` | `#53E7DE` |
| Acento al interactuar | `accentHover` | `#8AFBF2` |
| Fondo del acento | `accentSoft` | `#0B282F` |
| Actividad elevada | `warm` | `#FFAD66` |
| Anomalía crítica | `danger` | `#FF6172` |
| Resplandor del globo | `glow` | `#42B8FF` |
| Océano de la escena | `ocean` | `#071B38` |
| Límites cartográficos | `boundaries` | `#35C7D4` |

`web/src/lib/theme.ts` es la única fuente de los colores de interfaz. El layout expone las variables CSS; Three.js, la esfera compatible Canvas, los mapas SVG, las líneas de tiempo y las ondas importan los mismos tokens. La paleta se aplica al explorador, observatorio, Jukebox EIC, datos recientes, diálogos y estados desactivados. Los estados desactivados también utilizan tokens; no mantienen colores verdes independientes.

La captura se conserva como referencia visual, sin afirmar coincidencia exacta de medidas de un nodo Figma no proporcionado. Se mantienen la navegación, filtros, globo, panel científico, línea de tiempo y sonificación de la aplicación funcional.

Los colores propios de la imagen científica NASA y de su leyenda identifican capas de aerosoles. Esa codificación se presenta como dato de origen. Los niveles térmicos también conservan etiquetas textuales además del color.

Las capturas `terraecho-release-*.jpg` y los informes anteriores conservan estados históricos; la restauración se documenta en `docs/evaluation/theme-restoration-check.json` y capturas `terraecho-navy-cyan-*.jpg`. La revisión en navegador sin GPU acelerada utiliza la esfera compatible; la comprobación GPU física sigue pendiente en U01.
