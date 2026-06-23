import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadLocalEnv() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

export function resolveAdbPath() {
  if (process.env.ADB_PATH && existsSync(process.env.ADB_PATH)) return process.env.ADB_PATH;

  const adbName = process.platform === "win32" ? "adb.exe" : "adb";
  const candidates = [
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", adbName) : "",
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", adbName) : "",
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),
    join(process.env.USERPROFILE || "", "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "adb";
}

export const adbPath = resolveAdbPath();

export function runAdb(args, { quiet = false } = {}) {
  try {
    return execFileSync(adbPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.message || "";
    if (!quiet && detail) console.warn(`adb 실패 (${adbPath}): ${detail.trim()}`);
    return "";
  }
}

export function getAdbDevices() {
  const output = runAdb(["devices"]);
  if (!output) return [];
  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && line.endsWith("device"))
    .map((line) => line.split("\t")[0]);
}

export function setupAdbReverse(port, deviceId = "") {
  const prefix = deviceId ? ["-s", deviceId] : [];
  return runAdb([...prefix, "reverse", `tcp:${port}`, `tcp:${port}`]);
}

export function setupChromeDevtoolsForward(deviceId = "") {
  const prefix = deviceId ? ["-s", deviceId] : [];
  return runAdb([...prefix, "forward", "tcp:9222", "localabstract:chrome_devtools_remote"]);
}

export function openOnAndroidChrome(url, deviceId = "") {
  const prefix = deviceId ? ["-s", deviceId] : [];
  const chromePackages = ["com.android.chrome", "com.chrome.beta", "com.chrome.dev"];
  for (const pkg of chromePackages) {
    const result = runAdb([
      ...prefix,
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      url,
      pkg,
    ]);
    if (result && !/Error|Exception/i.test(result)) return pkg;
  }
  runAdb([...prefix, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url]);
  return "";
}

export function detectAndroidSdkRoot() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  const candidate = join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
  if (existsSync(candidate)) return candidate;
  const fallback = join(process.env.USERPROFILE || "", "AppData", "Local", "Android", "Sdk");
  if (existsSync(fallback)) return fallback;
  return "";
}

export async function isPortOpen(targetPort) {
  try {
    const response = await fetch(`http://127.0.0.1:${targetPort}/`, { signal: AbortSignal.timeout(2000) });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
