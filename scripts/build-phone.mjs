import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchPhone } from "./phone-launch.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

execFileSync("node", ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
await launchPhone(["--port", "3000", "--server", "prod"]);
