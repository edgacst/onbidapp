import { execFileSync, spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiOrigin = process.env.VITE_API_ORIGIN || "https://edgauction.com";
const buildId = new Date().toISOString();
const shell = process.platform === "win32";

console.log(`Building Android bundle (API: ${apiOrigin})...`);

if (shell) {
  execFileSync("node", ["scripts/build.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_API_ORIGIN: apiOrigin,
      VITE_APP_BUILD: buildId,
    },
  });
} else {
  execFileSync("npm", ["run", "build:inner"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_API_ORIGIN: apiOrigin,
      VITE_APP_BUILD: buildId,
    },
    shell,
  });
}

execFileSync("npx", ["cap", "sync", "android"], {
  cwd: root,
  stdio: "inherit",
  shell,
});

console.log(`✅ Android sync complete (${buildId})`);
console.log("다음: npm run build:aab 또는 Android Studio에서 Build > Generate Signed Bundle");
