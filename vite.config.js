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
        : undefined,
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
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["content-type"] = "image/jpeg";
              delete proxyRes.headers["content-disposition"];
              proxyRes.headers["cache-control"] = "public, max-age=3600";
            });
          },
          rewrite: (path) => path.replace(/^\/onbid-file/, ""),
        },
      },
    },
  };
});
