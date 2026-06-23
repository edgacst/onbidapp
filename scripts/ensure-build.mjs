import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const distIndex = join(distDir, "index.html");
const sourceFiles = [
  join(root, "src", "main.jsx"),
  join(root, "src", "styles.css"),
  join(root, "index.html"),
  join(root, "vite.config.js"),
];

function newestMtime(paths) {
  return Math.max(
    0,
    ...paths
      .filter((filePath) => existsSync(filePath))
      .map((filePath) => statSync(filePath).mtimeMs),
  );
}

function distAssetSummary() {
  const assetsDir = join(distDir, "assets");
  if (!existsSync(assetsDir)) return "없음";
  return readdirSync(assetsDir)
    .filter((name) => /\.(js|css)$/.test(name))
    .sort()
    .join(", ");
}

const sourceMtime = newestMtime(sourceFiles);
const distMtime = existsSync(distIndex) ? statSync(distIndex).mtimeMs : 0;
const needsBuild = !existsSync(distIndex) || sourceMtime > distMtime;

if (needsBuild) {
  console.log("소스가 dist보다 최신입니다. 프로덕션 빌드를 실행합니다...");
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", shell: true });
} else {
  console.log(`dist 최신 상태 (${new Date(distMtime).toLocaleString("ko-KR")})`);
}

console.log(`빌드 산출물: ${distAssetSummary()}`);
