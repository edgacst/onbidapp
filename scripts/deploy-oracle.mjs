import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readEnvLocal(key) {
  try {
    const content = readFileSync(join(root, ".env.local"), "utf8");
    const line = content.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : "";
  } catch {
    return "";
  }
}

const host = process.env.ORACLE_HOST || process.env.DEPLOY_HOST || readEnvLocal("ORACLE_HOST");
const user = process.env.ORACLE_USER || process.env.DEPLOY_USER || readEnvLocal("ORACLE_USER") || "ubuntu";
const action = process.argv.includes("--setup") ? "setup" : "update";

if (!host) {
  console.log(`
Oracle Cloud 원격 배포 도우미

1) VM에서 최초 1회 (SSH 접속 후):
   git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
   cd /opt/onbidapp
   sudo bash deploy/oracle/setup-vm.sh [도메인]

2) 이후 PC에서 업데이트 배포:
   .env.local 에 ORACLE_HOST=공인IP 또는 도메인 추가
   npm run deploy:oracle

자세한 가이드: docs/DEPLOY-ORACLE.md
`);
  process.exit(0);
}

const remoteScript = action === "setup"
  ? "cd /opt/onbidapp && sudo bash deploy/oracle/setup-vm.sh"
  : "sudo bash /opt/onbidapp/deploy/oracle/update-app.sh";

console.log(`SSH ${user}@${host} → ${action}`);
const result = spawnSync("ssh", [`${user}@${host}`, remoteScript], { stdio: "inherit" });
process.exit(result.status ?? 1);
