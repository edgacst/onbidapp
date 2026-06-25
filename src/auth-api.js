const AUTH_TOKEN_KEY = "auctionAuthToken";

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

async function authRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.message || "요청에 실패했습니다."));
  }
  return payload;
}

export async function authSignup({ email, name, password }) {
  const payload = await authRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, name, password }),
  });
  setAuthToken(payload.token);
  return payload;
}

export async function authLogin({ email, password }) {
  const payload = await authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(payload.token);
  return payload;
}

export async function authMe() {
  return authRequest("/api/auth/me");
}

export async function authLogout() {
  try {
    await authRequest("/api/auth/logout", { method: "POST", body: "{}" });
  } finally {
    setAuthToken("");
  }
}

export async function fetchMembers() {
  const payload = await authRequest("/api/auth/members");
  return payload.members || [];
}

export async function patchMember(id, body) {
  const payload = await authRequest(`/api/auth/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return payload.member;
}

export async function removeMember(id) {
  await authRequest(`/api/auth/members/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
