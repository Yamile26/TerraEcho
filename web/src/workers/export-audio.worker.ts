import { eicWave } from "../lib/wav";
import { parseEicScore } from "../lib/eic";
self.onmessage = (event) => {
  try {
    const score = parseEicScore(event.data.score),
      buffer = eicWave(score, event.data.enabled, event.data.mono);
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch {
    self.postMessage({ error: "No se pudo generar un WAV válido." });
  }
};
