const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function jsonFetch(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || `Request failed: ${res.status}`);
  return data;
}

export function signup(payload) { return jsonFetch("/api/auth/register", "POST", payload); }
export function login(payload) { return jsonFetch("/api/auth/login", "POST", payload); }
export function resetPassword(payload) {
  return jsonFetch("/api/auth/reset-password", "POST", payload);
}

export function me(token) {
  // optional: pass token in Authorization header from caller
  const opts = {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "include",
  };
  return fetch(API_BASE + "/api/me", opts).then(r => r.json());
}
