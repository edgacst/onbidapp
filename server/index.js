import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, statSync } from "node:fs";
import { loadEnvFiles } from "./load-env.js";
import { isMailConfigured, sendWelcomeEmail } from "./send-mail.js";

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

const apiResponseCache = new Map();
const API_CACHE_TTL_MS = 90_000;
const API_CACHE_MAX_ENTRIES = 400;

function apiCacheKey(url) {
  return String(url || "")
    .replace(/([?&])serviceKey=[^&]*(&?)/g, "$1")
    .replace(/[?&]$/, "");
}

function pruneApiCache() {
  if (apiResponseCache.size <= API_CACHE_MAX_ENTRIES) return;
  const entries = [...apiResponseCache.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let index = 0; index < entries.length - API_CACHE_MAX_ENTRIES; index += 1) {
    apiResponseCache.delete(entries[index][0]);
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

app.post("/api/members/welcome", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim() || email.split("@")[0] || "회원";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, message: "유효한 이메일이 필요합니다." });
    return;
  }
  if (!isMailConfigured()) {
    res.status(503).json({ ok: false, message: "메일 서버가 설정되지 않았습니다." });
    return;
  }
  try {
    await sendWelcomeEmail({ email, name });
    res.json({ ok: true, message: "환영 메일을 발송했습니다." });
  } catch (err) {
    console.error("[welcome-mail]", err?.message || err);
    res.status(500).json({ ok: false, message: "환영 메일 발송에 실패했습니다." });
  }
});

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

app.use("/onbid-api", (req, res, next) => {
  if (req.method !== "GET") return next();
  const key = apiCacheKey(req.originalUrl);
  const hit = apiResponseCache.get(key);
  if (hit && Date.now() - hit.at < API_CACHE_TTL_MS) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Onbid-Cache", "HIT");
    res.send(hit.body);
    return;
  }
  req.onbidCacheKey = key;
  next();
});

app.use(
  "/onbid-api",
  createSafeProxy("onbid-api", {
    target: "https://apis.data.go.kr",
    changeOrigin: true,
    pathRewrite: rewriteOnbidApiPath,
    selfHandleResponse: true,
    on: {
      proxyRes(proxyRes, req, res) {
        const chunks = [];
        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          if (req.onbidCacheKey && proxyRes.statusCode === 200) {
            apiResponseCache.set(req.onbidCacheKey, {
              body: body.toString("utf8"),
              at: Date.now(),
            });
            pruneApiCache();
          }
          if (!res.headersSent) {
            res.status(proxyRes.statusCode || 502);
            Object.entries(proxyRes.headers || {}).forEach(([name, value]) => {
              if (value !== undefined) res.setHeader(name, value);
            });
            res.setHeader("X-Onbid-Cache", req.onbidCacheKey ? "MISS" : "SKIP");
            res.end(body);
          }
        });
      },
    },
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
  app.get(/^(?!\/onbid-api|\/onbid-file|\/api).*/, (_req, res) => {
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
  console.log(`✅ 에드가공매 서버 http://localhost:${port}`);
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
  if (isMailConfigured()) {
    console.log("   메일: 환영 메일 발송 설정됨");
  } else {
    console.log("   메일: SMTP 미설정 — 회원가입 환영 메일 비활성");
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
