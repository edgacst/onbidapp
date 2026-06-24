import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPortOpen,
  lanAddresses,
  printRunningUrls,
  serverPaths,
  serverPort,
  spawnDetachedServer,
  spawnForegroundServer,
  waitForPort,
} from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();
const foreground = process.argv.includes("--foreground");

async function main() {
  if (await isPortOpen(port)) {
    printRunningUrls(port);
    return;
  }

  execFileSync("node", ["scripts/ensure-build.mjs"], { cwd: root, stdio: "inherit" });

  if (foreground) {
    const child = spawnForegroundServer(root, port);
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  const pid = spawnDetachedServer(root, port);
  if (!(await waitForPort(port))) {
    const { logPath } = serverPaths(root);
    console.error(`❌ 포트 ${port}에서 서버를 확인할 수 없습니다.`);
    console.error(`   로그 확인: ${logPath}`);
    process.exit(1);
  }

  console.log(`✅ 서버 시작 완료 (PID ${pid}) http://localhost:${port}`);
  for (const address of lanAddresses()) {
    console.log(`   폰(Wi-Fi): http://${address}:${port}`);
  }
  console.log("   터미널을 닫아도 서버는 계속 실행됩니다.");
  console.log("   로그: logs/server.log");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
