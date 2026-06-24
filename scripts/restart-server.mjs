import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPortOpen,
  killPort,
  lanAddresses,
  serverPort,
  waitForPort,
} from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();

if (await isPortOpen(port)) {
  console.log(`포트 ${port} 정리 중...`);
  killPort(port);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

console.log("빌드 확인 중...");
execFileSync("node", ["scripts/ensure-build.mjs"], { cwd: root, stdio: "inherit" });

console.log("서버 시작 중...");
spawn("node", ["server/index.js"], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  env: { ...process.env, PORT: String(port) },
}).unref();

if (!(await waitForPort(port))) {
  console.error(`❌ 포트 ${port}에서 서버를 확인할 수 없습니다.`);
  process.exit(1);
}

console.log(`✅ 서버 재시작 완료 http://localhost:${port}`);
for (const address of lanAddresses()) {
  console.log(`   폰(Wi-Fi): http://${address}:${port}`);
}
console.log("   터미널을 닫아도 서버는 백그라운드에서 계속 실행됩니다.");
