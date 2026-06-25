import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function parseEnvValue(raw) {
  let value = String(raw || "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  const commentIndex = value.indexOf(" #");
  if (commentIndex !== -1) value = value.slice(0, commentIndex).trim();
  return value;
}

function shouldApplyEnvValue(currentValue) {
  return currentValue == null || String(currentValue).trim() === "";
}

function applyEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = parseEnvValue(trimmed.slice(separator + 1));
    if (key && shouldApplyEnvValue(process.env[key])) process.env[key] = value;
  }
}

export function loadEnvFiles(rootDir) {
  applyEnvFile(join(rootDir, ".env"));
  applyEnvFile(join(rootDir, ".env.local"));
}
