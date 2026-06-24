import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, statSync } from "node:fs";
import { loadEnvFiles } from "./load-env.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const onbidServiceKey = process.env.ONBID_SERVICE_KEY || process.env.VITE_ONBID_SERVICE_KEY || "";
const port = Number(process.env.PORT || 3000);
const distPath = path.join(root, "dist");

if (!onbidServiceKey) {
  console.warn("⚠️  ONBID_SERVICE_KEY 또는 VITE_ONBID_SERVICE_KEY가 없습니다. API 호출이 실패합니다.");
}

function rewriteOnbidApiPath(pathname) {
  const nextPath = pathname.replace(/^\/onbid-api/, "");
  const separator = nextPath.includes("?") ? "&" : "?";
  return `${nextPath}${separator}serviceKey=${onbidServiceKey}`;
}

const app = express();

function createSafeProxy(label, options) {
  return createProxyMiddleware({
    ...options,
    on: {
      ...options.on,
      error(err, req, res) {
        console.error(`[${label}]`, err?.message || err);
        options.on?.error?.(err, req, res);
        if (res && typeof res.writeHead === "function" && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`${label} 프록시 오류`);
        }
      },
    },
  });
}

app.use(
  "/onbid-api",
  createSafeProxy("onbid-api", {
    target: "https://apis.data.go.kr",
    changeOrigin: true,
    pathRewrite: rewriteOnbidApiPath,
  }),
);

app.use(
  "/onbid-file",
  createSafeProxy("onbid-file", {
    target: "https://www.onbid.co.kr",
    changeOrigin: true,
    pathRewrite: (pathname) => pathname.replace(/^\/onbid-file/, ""),
    onProxyReq(proxyReq) {
      proxyReq.setHeader("Referer", "https://www.onbid.co.kr/");
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    },
    onProxyRes(proxyRes, req) {
      delete proxyRes.headers["content-disposition"];
      proxyRes.headers["cache-control"] = "public, max-age=3600";
      const requestPath = req?.url || "";
      if (requestPath.includes("dnldFile.do") || requestPath.includes("dnldImgFile.do")) {
        const contentType = String(proxyRes.headers["content-type"] || "");
        if (!contentType.startsWith("image/")) {
          proxyRes.headers["content-type"] = "image/jpeg";
        }
      }
    },
  }),
);

if (existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const baseName = path.basename(filePath);
        if (baseName === "index.html" || baseName.endsWith(".webmanifest")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get(/^(?!\/onbid-api|\/onbid-file).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text/plain; charset=utf-8")
      .send("dist/ 폴더가 없습니다. 먼저 npm run build 를 실행하세요.");
  });
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

function printServerUrls(port) {
  console.log(`✅ 공매레이더 서버 http://localhost:${port}`);
  for (const address of lanAddresses()) {
    console.log(`   폰(Wi-Fi): http://${address}:${port}`);
  }
  console.log(`   폰(USB):  npm run phone  → http://127.0.0.1:${port}`);
  if (existsSync(distPath)) {
    try {
      const distIndex = path.join(distPath, "index.html");
      const builtAt = statSync(distIndex).mtime.toLocaleString("ko-KR");
      const assets = readdirSync(path.join(distPath, "assets")).filter((name) => name.endsWith(".css")).join(", ");
      console.log(`   dist 빌드: ${builtAt}`);
      console.log(`   CSS: ${assets || "없음"}`);
      console.log("   ※ git pull 후에는 npm start 만 해도 자동 빌드됩니다.");
    } catch {
      // ignore dist read errors
    }
  } else {
    console.log("   (프론트 빌드 없음 — API 프록시만 동작)");
  }
}

const server = app.listen(port, "0.0.0.0", () => {
  printServerUrls(port);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ 포트 ${port}이(가) 이미 사용 중입니다.`);
    printServerUrls(port);
    console.error("\n이미 켜져 있으면 그대로 접속하세요. 다시 시작: npm run restart");
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
