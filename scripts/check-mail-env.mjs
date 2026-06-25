import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../server/load-env.js";
import { isMailConfigured } from "../server/send-mail.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const envPath = join(root, ".env");
const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_FROM_NAME"];

console.log(`env file: ${existsSync(envPath) ? envPath : "(없음)"}`);
for (const key of keys) {
  const fromFile = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${key}=`))
    : "";
  const runtime = process.env[key];
  const runtimeState = runtime && String(runtime).trim()
    ? `set (${String(runtime).trim().length} chars)`
    : "EMPTY";
  console.log(`${key}: file=${fromFile ? "있음" : "없음"}, runtime=${runtimeState}`);
}

console.log(`isMailConfigured: ${isMailConfigured() ? "YES" : "NO"}`);
