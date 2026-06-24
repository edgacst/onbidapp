import os from "node:os";
import { isPortOpen } from "./phone-adb.mjs";

function lanAddresses() {
  const addresses = new Set();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses];
}

async function main() {
  const port = Number(process.env.PORT || process.env.PHONE_PROD_PORT || 3000);
  const serverUp = await isPortOpen(port);
  const lan = lanAddresses();

  console.log("\n=== 폰 Wi-Fi 접속 안내 ===\n");
  if (!serverUp) {
    console.log("❌ 서버가 꺼져 있습니다. 먼저 실행하세요:");
    console.log("   npm start");
    process.exit(1);
  }

  console.log("✅ PC 서버 실행 중 (포트 " + port + ")");
  console.log("\n폰 Chrome 주소 (http:// 로 시작, :3000 필수):");
  for (const address of lan) {
    console.log(`   http://${address}:${port}`);
  }

  console.log("\n체크리스트:");
  console.log("  • PC와 폰이 같은 Wi-Fi");
  console.log("  • 폰 모바일 데이터(5G/LTE) 끄기");
  console.log("  • 주소에 :5173 이 아닌 :3000 사용");
  console.log("  • 연결 안 되면 방화벽 허용 (관리자 PowerShell):");
  console.log("      npm run phone:firewall");

  if (lan.length) {
    const testUrl = `http://${lan[0]}:${port}/`;
    try {
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
      console.log(`\nPC 자체 LAN 테스트: ${res.ok ? "OK" : "HTTP " + res.status}`);
    } catch (err) {
      console.log("\nPC LAN 테스트 실패:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
