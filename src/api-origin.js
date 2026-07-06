export function getApiOrigin() {
  return String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
}

export function resolveApiUrl(path) {
  const normalized = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  const origin = getApiOrigin();
  return origin ? `${origin}${normalized}` : normalized;
}
