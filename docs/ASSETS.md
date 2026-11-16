# Assets and source attribution

| Asset | Origin and role |
| --- | --- |
| `web/public/textures/earth.jpg` | Downloaded from the official Three.js examples asset `https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg`. Earth surface context only; not current satellite imagery and not a fire measurement layer. |
| `data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png` | Existing repository asset. NASA GMAO and NASA Scientific Visualization Studio, [GEOS Aerosols (2025), SVS 5669](https://svs.gsfc.nasa.gov/5669/). Visualizers Joseph V. Ardizzone and Helen-Nicole Kostis; scientific consulting Lesley Ott. Global modeled-aerosol visualization from August 19, 2025, 20:00 UTC. |
| `data/scores/eic_aerosols.json` | Existing Python-derived color/position sonification score of that image. Visual features, not measured concentrations. Method inspired by [NASA SVS 13786](https://svs.gsfc.nasa.gov/13786/). |
| `data/scores/terraecho_2025.json`, `terraecho_2026.json` | Existing team-produced exports attributed to NASA FIRMS VIIRS Suomi NPP. Provenance and geographic limits are described in `WEB_ARCHITECTURE.md`. |
| `data/peru_departments.geojson` | Existing simplified geoBoundaries Peru ADM1 file, as credited by the original repository README. Used to assign cell centers to departments. |
| Interface icons | Local SVG paths authored for this interface. No icon CDN or third-party icon font. |
| DM Sans / Manrope | Google Fonts CSS, optional enhancement; system fonts remain available when the external font service is unreachable. |

Satellites and wavefronts are illustrative design elements. No orbital ephemerides, measured electromagnetic propagation or real satellite positions are claimed. The project is a team submission for NASA Space Apps, not an official NASA alert product or NASA-endorsed application.
