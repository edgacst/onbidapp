import { execSync, spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";

export function serverPort() {
  return Number(process.env.PORT || 3000);
}

export function serverPaths(root) {
  const logDir = join(root, "logs");
  return {
    logDir,
    logPath: join(logDir, "server.log"),
    pidPath: join(logDir, "server.pid"),
  };
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

export function readServerPid(root) {
  const { pidPath } = serverPaths(root);
  if (!existsSync(pidPath)) return 0;
  const pid = Number(String(readFileSync(pidPath, "utf8")).trim());
  return Number.isFinite(pid) && pid > 0 ? pid : 0;
}

export function writeServerPid(root, pid) {
  const { logDir, pidPath } = serverPaths(root);
  mkdirSync(logDir, { recursive: true });
  writeFileSync(pidPath, String(pid), "utf8");
}

export function clearServerPid(root) {
  const { pidPath } = serverPaths(root);
  if (existsSync(pidPath)) writeFileSync(pidPath, "", "utf8");
}

export function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcess(pid) {
  if (!pid) return false;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    return true;
  } catch {
    return false;
  }
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

export function stopServer(root, port = serverPort()) {
  const pid = readServerPid(root);
  if (pid && isProcessAlive(pid)) {
    killProcess(pid);
  } else {
    killPort(port);
  }
  clearServerPid(root);
}

export function spawnDetachedServer(root, port = serverPort()) {
  const { logDir, logPath } = serverPaths(root);
  mkdirSync(logDir, { recursive: true });
  writeFileSync(logPath, `[${new Date().toISOString()}] server starting on port ${port}\n`, { flag: "a" });

  const out = openSync(logPath, "a");
  const err = openSync(logPath, "a");
  const child = spawn("node", ["server/index.js"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
    env: { ...process.env, PORT: String(port) },
  });
  closeSync(out);
  closeSync(err);
  child.unref();
  writeServerPid(root, child.pid);
  return child.pid;
}

export function spawnForegroundServer(root, port = serverPort()) {
  return spawn("node", ["server/index.js"], {
    cwd: root,
    detached: false,
    stdio: "inherit",
    windowsHide: false,
    env: { ...process.env, PORT: String(port) },
  });
}
