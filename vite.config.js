import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const onbidServiceKey = env.ONBID_SERVICE_KEY || env.VITE_ONBID_SERVICE_KEY || "";
  const useNgrok = env.USE_NGROK === "true";
  const ngrokHost = useNgrok ? env.NGROK_HOST || "" : "";

  return {
    plugins: [react()],
    build: {
      minify: false,
    },
    server: {
      host: true,
      allowedHosts: true,
      hmr: ngrokHost
        ? {
            protocol: "wss",
            host: ngrokHost,
            clientPort: 443,
          }
        : {
            host: "localhost",
            port: 5173,
            clientPort: 5173,
          },
      proxy: {
        "/onbid-api": {
          target: "https://apis.data.go.kr",
          changeOrigin: true,
          rewrite: (path) => {
            const nextPath = path.replace(/^\/onbid-api/, "");
            const separator = nextPath.includes("?") ? "&" : "?";
            return `${nextPath}${separator}serviceKey=${onbidServiceKey}`;
          },
        },
        "/onbid-file": {
          target: "https://www.onbid.co.kr",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Referer", "https://www.onbid.co.kr/");
              proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              delete proxyRes.headers["content-disposition"];
              proxyRes.headers["cache-control"] = "public, max-age=3600";
              const requestPath = req?.url || "";
              if (requestPath.includes("dnldFile.do") && !String(proxyRes.headers["content-type"] || "").startsWith("image/")) {
                proxyRes.headers["content-type"] = "image/jpeg";
              }
            });
          },
          rewrite: (path) => path.replace(/^\/onbid-file/, ""),
        },
      },
    },
  };
});
