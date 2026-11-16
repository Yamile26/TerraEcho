import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./prepare-data.mjs";
const web = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
function option(...names) {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0 && args[index + 1]) return args[index + 1];
    const inline = args.find((v) => v.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
  }
}
// Accept standard host/port flags from local preview tools as well as PORT.
const host = option("--host", "--hostname") ?? "0.0.0.0",
  port = option("--port", "-p") ?? process.env.PORT ?? "3000";
const child = spawn(
  process.execPath,
  [
    path.join(web, "../node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    host,
    "--port",
    port,
  ],
  {
    cwd: web,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
