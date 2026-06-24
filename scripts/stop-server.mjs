import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPortOpen, serverPort, stopServer } from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();

if (!(await isPortOpen(port))) {
  console.log(`포트 ${port}에서 실행 중인 서버가 없습니다.`);
  process.exit(0);
}

console.log(`포트 ${port} 서버 종료 중...`);
stopServer(root, port);
await new Promise((resolve) => setTimeout(resolve, 1500));

if (await isPortOpen(port)) {
  console.error(`❌ 포트 ${port} 서버를 종료하지 못했습니다.`);
  process.exit(1);
}

console.log("✅ 서버를 종료했습니다.");
