import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildId = new Date().toISOString();

execFileSync("npm", ["run", "build:inner"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_APP_BUILD: buildId },
  shell: process.platform === "win32",
});

console.log(`Production build complete (${buildId}).`);
