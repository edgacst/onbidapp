import os from "node:os";
import {
  adbPath,
  getAdbDevices,
  isPortOpen,
  openOnAndroidChrome,
  setupAdbReverse,
  setupChromeDevtoolsForward,
} from "./phone-adb.mjs";

function lanAddresses() {
  const addresses = new Set();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses];
}

function parseArgs(argv) {
  const options = {
    openDevice: true,
    ports: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-open") options.openDevice = false;
    else if (arg === "--port") options.ports.push(Number(argv[++i]));
  }
  return options;
}

async function pickActivePort(ports) {
  for (const port of ports) {
    if (await isPortOpen(port)) return port;
  }
  return ports[0];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const devices = getAdbDevices();
  if (devices.length === 0) {
    console.error("USB로 연결된 Android 기기가 없습니다.");
    console.error("1) 폰 USB 디버깅 켜기");
    console.error("2) USB 케이블 연결");
    console.error("3) npm run phone:setup  (최초 1회)");
    process.exit(1);
  }

  const deviceId = devices[0];
  const ports = options.ports.length
    ? options.ports
    : [Number(process.env.PHONE_PROD_PORT || 3000), Number(process.env.PHONE_DEV_PORT || 5173)];

  for (const port of ports) {
    setupAdbReverse(port, deviceId);
  }
  setupChromeDevtoolsForward(deviceId);

  const activePort = await pickActivePort(ports);
  const deviceUrl = `http://127.0.0.1:${activePort}/`;
  const serverRunning = await isPortOpen(activePort);

  console.log("\n=== 폰 USB 연결 (유선) ===");
  console.log(`adb:     ${adbPath}`);
  console.log(`기기:    ${deviceId}`);
  console.log(`reverse: ${ports.map((port) => `tcp:${port}`).join(", ")}`);
  console.log(`폰 URL:  ${deviceUrl}${serverRunning ? "" : "  ← 서버 미실행"}`);
  console.log("※ USB 디버깅 중에는 Wi-Fi 주소(192.168.x.x)가 아니라 위 127.0.0.1 주소를 쓰세요.");
  console.log("PC 디버깅: Chrome → chrome://inspect → Remote devices");

  if (options.openDevice) {
    const pkg = openOnAndroidChrome(deviceUrl, deviceId);
    console.log(pkg ? `폰 Chrome(${pkg}) 실행` : "폰 브라우저 실행 시도");
  }

  const lan = lanAddresses();
  if (lan.length) {
    console.log("\n=== 폰 Wi-Fi (무선, 같은 공유기) ===");
    for (const address of lan) {
      console.log(`폰 URL:  http://${address}:${activePort}/`);
    }
    console.log("※ USB 케이블 연결·디버깅 중이면 Wi-Fi 주소 대신 위 USB(127.0.0.1) 주소를 쓰세요.");
    console.log("모바일 데이터 OFF · 연결 안 되면: npm run phone:firewall");
  }

  if (!serverRunning) {
    console.log("\n서버 먼저 실행:");
    console.log("  운영(권장): npm start");
    console.log("  개발:       npm run dev");
  } else if (activePort === 5173) {
    console.log("\n※ 개발 서버(5173)에 연결됨. 최신 빌드 확인은 npm start 후 :3000 사용");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
