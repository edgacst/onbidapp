import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adbPath, detectAndroidSdkRoot, getAdbDevices, resolveAdbPath } from "./phone-adb.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env.local");

function upsertEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.trimEnd()}\n${line}\n`;
}

function main() {
  const sdkRoot = detectAndroidSdkRoot();
  const adb = resolveAdbPath();

  if (!existsSync(adb) && adb === "adb") {
    console.error("adb를 찾지 못했습니다. Android Studio SDK(platform-tools)를 설치하세요.");
    process.exit(1);
  }

  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  envContent = upsertEnvValue(envContent, "ADB_PATH", adb.replace(/\\/g, "/"));
  if (sdkRoot) envContent = upsertEnvValue(envContent, "ANDROID_HOME", sdkRoot.replace(/\\/g, "/"));
  envContent = upsertEnvValue(envContent, "PHONE_DEV_PORT", "5173");
  envContent = upsertEnvValue(envContent, "PHONE_PROD_PORT", "3000");
  writeFileSync(envPath, envContent.endsWith("\n") ? envContent : `${envContent}\n`);

  const devices = getAdbDevices();
  console.log("폰 디버깅 환경 설정 완료");
  console.log(`  .env.local 업데이트: ${envPath}`);
  console.log(`  ADB_PATH=${adb}`);
  if (sdkRoot) console.log(`  ANDROID_HOME=${sdkRoot}`);
  if (devices.length > 0) {
    console.log(`  연결된 기기: ${devices.join(", ")}`);
  } else {
    console.log("  연결된 기기 없음 — USB 디버깅 켜고 케이블 연결 후 npm run phone");
  }
}

main();
