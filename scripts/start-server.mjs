import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPortOpen,
  printRunningUrls,
  serverPort,
  waitForPort,
} from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();
const foreground = process.argv.includes("--foreground");
const background = process.argv.includes("--background");

async function main() {
  if (await isPortOpen(port)) {
    printRunningUrls(port);
    return;
  }

  execFileSync("node", ["scripts/ensure-build.mjs"], { cwd: root, stdio: "inherit" });

  const detached = background || !foreground;
  const child = spawn("node", ["server/index.js"], {
    cwd: root,
    detached,
    stdio: detached ? "ignore" : "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  if (detached) {
    child.unref();
    if (!(await waitForPort(port))) {
      console.error(`❌ 포트 ${port}에서 서버를 확인할 수 없습니다.`);
      process.exit(1);
    }
    console.log(`✅ 서버 시작 완료 http://localhost:${port}`);
    console.log("   터미널을 닫아도 서버는 백그라운드에서 계속 실행됩니다.");
    return;
  }

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
