"""Render the 53-task ledger from its reviewable JSON source."""

import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "docs/evaluation/task-status.json"
data = json.loads(source.read_text())
expected = {
    f"{prefix}{n:02}"
    for prefix, count in [
        ("E", 8),
        ("D", 10),
        ("F", 6),
        ("S", 8),
        ("A", 6),
        ("U", 6),
        ("R", 9),
    ]
    for n in range(1, count + 1)
}
tasks = data["tasks"]
assert len(tasks) == 53 and {t["id"] for t in tasks} == expected
assert all(t["status"] in {"cerrada", "parcial", "externa"} for t in tasks)
counts = Counter(t["status"] for t in tasks)
data["counts"] = dict(counts)
source.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
intro = f"""# Estado comprobable de las 53 tareas

Corte: {data['reviewDate']} UTC. **No se declaran 53 tareas terminadas.** Cada fila distingue implementación de evidencia externa. “Cerrada” puede incluir una promesa delimitada explícitamente en vez de una función científica no validada. “Parcial” tiene trabajo implementado y una comprobación pendiente. “Externa” necesita participantes, cuenta/sede o decisiones de personas reales; el paquete para ejecutarla está preparado.

**{counts['cerrada']} cerradas · {counts['parcial']} parciales · {counts['externa']} externas pendientes.** No es un porcentaje de calidad ni una probabilidad de ganar.

| ID | Estado | Tarea y evidencia | Cierre pendiente / límite |
| --- | --- | --- | --- |
"""
for task in tasks:
    intro += f"| {task['id']} | {task['status']} | **{task['title']}.** {task['evidence']} | {task['remaining'] or '—'} |\n"
intro += """
## Evidencia y siguientes comprobaciones

- Fuentes/reproducción: `data/manifests/`, `data/scores/science-qa.json`, `terraecho/science.py`, `tests/test_science.py` y `scripts/reproduce_release.py`.
- Sensibilidad y mezcla: `docs/evaluation/release-sensitivity.json`.
- Navegador y audio: `docs/evaluation/axe-*-mobile.json`, `browser-audio-check.json`, `reference-audio-check.json` y `docs/screenshots/terraecho-release-*.jpg`.
- Personas y dispositivos: [protocolo](evaluation/PROTOCOL.md); registros vacíos deliberadamente.
- Entrega: [despliegue](DEPLOYMENT.md), [envío](ENTREGA_SPACE_APPS.md), [licencia](LICENSE_PROPOSAL.md), [decisiones](DECISIONES_TECNICAS.md) y [validación](VALIDATION.md).

Solo el equipo puede aportar la nueva consulta NOAA-20 con su clave local, sesiones consentidas, revisión independiente de máscaras, GPU/tacto/lectores reales, responsables, aprobación de autoría/licencia y envío oficial. La conexión anterior con cero detecciones no demuestra una nueva consulta NOAA ni cobertura completa. No enviar la MAP_KEY al chat ni al repositorio.

Fuente editable: `docs/evaluation/task-status.json`; regenerar con `python scripts/render_task_status.py`.
"""
(ROOT / "docs/ESTADO_53_TAREAS.md").write_text(intro)
print(dict(counts))
