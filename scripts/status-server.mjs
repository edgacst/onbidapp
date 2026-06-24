import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPortOpen,
  isProcessAlive,
  lanAddresses,
  readServerPid,
  serverPort,
} from "./server-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = serverPort();

async function checkHttp() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

const pid = readServerPid(root);
const portOpen = await isPortOpen(port);
const httpOk = portOpen ? await checkHttp() : false;
const pidAlive = pid ? isProcessAlive(pid) : false;

if (portOpen && httpOk) {
  console.log(`✅ 서버 정상 (PID ${pid || "알 수 없음"}, HTTP 200)`);
  console.log(`   PC: http://localhost:${port}`);
  for (const address of lanAddresses()) {
    console.log(`   폰(Wi-Fi): http://${address}:${port}`);
  }
  console.log("   ※ npm start 후 프롬프트가 돌아와도 서버는 백그라운드에서 계속 실행됩니다.");
  process.exit(0);
}

if (portOpen && !httpOk) {
  console.log(`⚠️ 포트 ${port}은 열려 있지만 HTTP 응답이 없습니다.`);
  console.log("   npm run restart");
  process.exit(1);
}

console.log(`❌ 서버가 꺼져 있습니다.`);
console.log("   npm start");
process.exit(1);
