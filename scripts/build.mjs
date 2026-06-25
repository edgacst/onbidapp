import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

try {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const buildRoot = join(tmpdir(), `onbid-auction-app-build-${Date.now()}`);
  const files = [
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "postcss.config.js",
    ".env.local",
    "src",
    "public",
  ];

  console.log(`Preparing build workspace: ${buildRoot}`);
  mkdirSync(buildRoot, { recursive: true });

  for (const file of files) {
    const source = join(root, file);
    if (existsSync(source)) {
      console.log(`Copying ${file}...`);
      if (statSync(source).isDirectory()) {
        const result = spawnSync("robocopy.exe", [source, join(buildRoot, file), "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], {
          stdio: "inherit",
        });
        if (result.status > 7) {
          throw new Error(`robocopy failed for ${file} with exit code ${result.status}`);
        }
      } else {
        cpSync(source, join(buildRoot, file), { recursive: true });
      }
    }
  }

  console.log("Installing build dependencies...");
  execFileSync("cmd.exe", ["/c", "npm", "install", "--silent"], { cwd: buildRoot, stdio: "inherit" });
  console.log("Running Vite build...");
  const buildId = new Date().toISOString();
  execFileSync("cmd.exe", ["/c", "npm", "run", "build:inner"], {
    cwd: buildRoot,
    stdio: "inherit",
    env: { ...process.env, VITE_APP_BUILD: buildId },
  });

  console.log("Copying dist back to project...");
  execFileSync("cmd.exe", ["/c", "if", "exist", "dist", "rmdir", "/s", "/q", "dist"], { cwd: root, stdio: "inherit" });
  const distCopy = spawnSync("robocopy.exe", [join(buildRoot, "dist"), join(root, "dist"), "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], {
    stdio: "inherit",
  });
  if (distCopy.status > 7) {
    throw new Error(`robocopy failed for dist with exit code ${distCopy.status}`);
  }
  console.log("Build complete.");
} catch (error) {
  console.error(error);
  process.exit(1);
}
