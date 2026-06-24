import { execSync } from "node:child_process";
import net from "node:net";
import os from "node:os";

export function serverPort() {
  return Number(process.env.PORT || 3000);
}

export function isPortOpen(targetPort) {
  return new Promise((resolvePort) => {
    const socket = net.connect({ host: "127.0.0.1", port: targetPort });
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

export async function waitForPort(targetPort, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(targetPort)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

export function lanAddresses() {
  const addresses = new Set();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses];
}

export function printRunningUrls(port) {
  console.log(`✅ 포트 ${port} 서버가 이미 실행 중입니다.`);
  console.log(`   PC: http://localhost:${port}`);
  for (const address of lanAddresses()) {
    console.log(`   폰(Wi-Fi): http://${address}:${port}`);
  }
  console.log(`   폰(USB): npm run phone → http://127.0.0.1:${port}`);
  console.log("   다시 시작하려면: npm run restart");
}

export function killPort(targetPort) {
  if (process.platform !== "win32") return;
  const cmd = `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
  try {
    execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: "ignore" });
  } catch {
    // ignore kill failures
  }
}
