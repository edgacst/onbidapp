import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const androidDir = join(root, "android");
const keystorePath = join(androidDir, "edgauction-release.jks");
const keystorePropsPath = join(androidDir, "keystore.properties");
const apiOrigin = process.env.VITE_API_ORIGIN || "https://edgauction.com";
const shell = process.platform === "win32";
const gradleCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || root,
    stdio: "inherit",
    shell: options.shell ?? shell,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${result.status})`);
  }
}

if (!existsSync(keystorePath)) {
  console.log("서명 키 생성 중...");
  mkdirSync(androidDir, { recursive: true });
  run("keytool", [
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", keystorePath,
    "-alias", "edgauction",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", "EdgAuction2026!",
    "-keypass", "EdgAuction2026!",
    "-dname", "CN=EdgAuction, OU=App, O=Edg, L=Bucheon, ST=Gyeonggi, C=KR",
  ], { shell: false });
}

if (!existsSync(keystorePropsPath)) {
  throw new Error("android/keystore.properties 가 없습니다.");
}

console.log(`웹 빌드 + Android sync (API: ${apiOrigin})...`);
run("node", ["scripts/build-android.mjs"], { env: { VITE_API_ORIGIN: apiOrigin }, shell: false });

console.log("AAB 빌드 중...");
run(join(androidDir, gradleCmd), ["bundleRelease"], { cwd: androidDir });

const aabPath = join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
console.log(`\n✅ AAB 빌드 완료\n   ${aabPath}`);
console.log("\n키스토어: android/edgauction-release.jks");
console.log("비밀번호: android/keystore.properties 참고 (Play 업데이트에 필요)");
