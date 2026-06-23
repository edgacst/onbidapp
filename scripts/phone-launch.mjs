import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adbPath,
  getAdbDevices,
  isPortOpen,
  openOnAndroidChrome,
  setupAdbReverse,
} from "./phone-adb.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const options = {
    port: 5173,
    server: "dev",
    keepAlive: false,
    openBrowser: false,
    openDevice: true,
    useTunnel: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") options.port = Number(argv[++i] || options.port);
    else if (arg === "--server") options.server = argv[++i] || options.server;
    else if (arg === "--keep-alive") options.keepAlive = true;
    else if (arg === "--no-browser") options.openBrowser = false;
    else if (arg === "--browser") options.openBrowser = true;
    else if (arg === "--no-device") options.openDevice = false;
    else if (arg === "--tunnel") options.useTunnel = true;
  }
  return options;
}

function lanAddresses() {
  const addresses = new Set();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
}

async function waitForPort(targetPort, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isPortOpen(targetPort)) return true;
    await sleep(500);
  }
  return false;
}

async function ensureServer(options) {
  if (await isPortOpen(options.port)) {
    console.log(`서버 실행 중 (포트 ${options.port})`);
    return;
  }

  if (options.server === "dev") {
    console.log(`개발 서버 시작 중... (포트 ${options.port})`);
    spawn(process.platform === "win32" ? "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev"] : ["run", "dev"], {
      cwd: root,
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    console.log(`프로덕션 서버 시작 중... (포트 ${options.port})`);
    spawn("node", ["server/index.js"], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PORT: String(options.port) },
    }).unref();
  }

  if (!(await waitForPort(options.port))) {
    throw new Error(`포트 ${options.port} 서버가 시작되지 않았습니다.`);
  }
}

async function startTunnel(targetPort) {
  const ngrokUrl = process.env.NGROK_URL || "https://mundane-maturely-bulgur.ngrok-free.dev";
  spawn("ngrok", ["http", String(targetPort), `--url=${ngrokUrl}`], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  }).unref();

  for (let i = 0; i < 20; i += 1) {
    await sleep(500);
    try {
      const payload = await fetch("http://127.0.0.1:4040/api/tunnels").then((res) => res.json());
      const tunnel = payload.tunnels?.find((item) => item.public_url?.startsWith("https://"));
      if (tunnel?.public_url) return tunnel.public_url;
    } catch {
      // retry
    }
  }
  return ngrokUrl.replace(/\/$/, "");
}

export async function launchPhone(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await ensureServer(options);

  const localUrl = `http://localhost:${options.port}/`;
  const lanUrls = lanAddresses().map((address) => `http://${address}:${options.port}/`);
  const adbDevices = getAdbDevices();
  const adbDeviceId = adbDevices[0] || "";

  if (adbDevices.length > 0) {
    setupAdbReverse(options.port, adbDeviceId);
    const deviceUrl = `http://127.0.0.1:${options.port}/`;
    console.log("\n=== USB 디버깅 기기 (Android) ===");
    console.log(`adb:  ${adbPath}`);
    console.log(`연결: ${adbDeviceId}`);
    console.log(`폰 URL: ${deviceUrl}`);
    console.log("PC 디버깅: Chrome → chrome://inspect → Remote devices");
    if (options.openDevice) {
      const openedBrowser = openOnAndroidChrome(deviceUrl, adbDeviceId);
      console.log(openedBrowser
        ? `연결된 폰 Chrome(${openedBrowser})에서 앱을 열었습니다.`
        : "폰 브라우저 열기를 시도했습니다.");
    }
  }

  console.log("\n=== 폰 접속 (같은 Wi-Fi) ===");
  console.log(`PC:   ${localUrl}`);
  for (const url of lanUrls) console.log(`폰:   ${url}`);
  if (adbDevices.length === 0) {
    console.log("USB 연결: npm run phone");
  }

  if (options.useTunnel) {
    const tunnelUrl = await startTunnel(options.port);
    console.log(`외부: ${tunnelUrl}`);
    const envPath = join(root, ".env.local");
    if (existsSync(envPath)) {
      let envContent = readFileSync(envPath, "utf8");
      const host = new URL(tunnelUrl).hostname;
      if (/^USE_NGROK=/m.test(envContent)) envContent = envContent.replace(/^USE_NGROK=.*$/m, "USE_NGROK=true");
      else envContent = `${envContent.trimEnd()}\nUSE_NGROK=true\n`;
      if (/^NGROK_HOST=/m.test(envContent)) envContent = envContent.replace(/^NGROK_HOST=.*$/m, `NGROK_HOST=${host}`);
      else envContent = `${envContent.trimEnd()}\nNGROK_HOST=${host}\n`;
      writeFileSync(envPath, envContent);
      console.log("ngrok 모드: 개발 서버를 재시작하세요.");
    }
  }

  if (options.openBrowser) openBrowser(localUrl);
  if (options.keepAlive) await new Promise(() => {});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  launchPhone().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
