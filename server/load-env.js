import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function applyEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

export function loadEnvFiles(rootDir) {
  applyEnvFile(join(rootDir, ".env"));
  applyEnvFile(join(rootDir, ".env.local"));
}
