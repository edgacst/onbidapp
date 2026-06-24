import { execSync, spawn } from "node:child_process";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);

function isPortOpen(targetPort) {
  return new Promise((resolvePort) => {
    const socket = net.connect({ host: "127.0.0.1", port: targetPort });
    socket.once("connect", () => {
      socket.end();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
  });
}

function killPort(targetPort) {
  if (process.platform !== "win32") return;
  const cmd = `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
  try {
    execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: "ignore" });
  } catch {
    // ignore kill failures
  }
}

if (await isPortOpen(port)) {
  console.log(`포트 ${port} 정리 중...`);
  killPort(port);
  await new Promise((r) => setTimeout(r, 1500));
}

const child = spawn("npm", ["start"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
