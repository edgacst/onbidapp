import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPortOpen,
  lanAddresses,
  serverPort,
  spawnDetachedServer,
  stopServer,
  waitForPort,
} from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();

if (await isPortOpen(port)) {
  console.log(`포트 ${port} 정리 중...`);
  stopServer(root, port);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

console.log("빌드 확인 중...");
execFileSync("node", ["scripts/ensure-build.mjs"], { cwd: root, stdio: "inherit" });

console.log("서버 시작 중...");
const pid = spawnDetachedServer(root, port);

if (!(await waitForPort(port))) {
  console.error(`❌ 포트 ${port}에서 서버를 확인할 수 없습니다.`);
  console.error("   로그 확인: logs/server.log");
  process.exit(1);
}

console.log(`✅ 서버 재시작 완료 (PID ${pid}) http://localhost:${port}`);
for (const address of lanAddresses()) {
  console.log(`   폰(Wi-Fi): http://${address}:${port}`);
}
console.log("   터미널을 닫아도 서버는 계속 실행됩니다.");
console.log("   로그: logs/server.log");
