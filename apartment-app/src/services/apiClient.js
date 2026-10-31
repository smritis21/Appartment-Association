/**
 * apiClient.js - thin fetch wrapper around the FastAPI backend.
 *
 * This is the single place the frontend talks to the network. Feature
 * services (src/services/*.js) build on it; components never call fetch
 * directly.
 *
 * Base URL comes from VITE_API_BASE_URL (see .env.example). If it isn't set,
 * we default to the local uvicorn dev server.
 *
 * Two error shapes are distinguished on purpose, because the UI reacts to
 * them very differently:
 *   ApiError     - the backend answered, but with a 4xx/5xx. The `detail`
 *                  message from FastAPI is worth showing to the user.
 *   NetworkError - the backend never answered (down, wrong port, CORS).
 *                  Callers can fall back to mock data instead of showing a
 *                  scary error, which keeps the app usable standalone.
 */

const BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

const DEFAULT_TIMEOUT_MS = 8000;

// Bearer token attached to every request once a user is signed in. Set by
// AuthContext on login/logout/app-init - apiClient itself never touches
// localStorage, it just holds whatever token it's given in memory.
let authToken = null;

/**
 * The current bearer token.
 *
 * Requests made through this module attach it themselves. This getter exists
 * for the few that cannot - multipart uploads and file downloads build their
 * own fetch - so they authenticate from the same source rather than keeping a
 * second copy of the token.
 */
export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token || null;
}

export class ApiError extends Error {
  constructor(status, detail, body) {
    super(detail || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message = "Could not reach the server.") {
    super(message);
    this.name = "NetworkError";
  }
}

/** True when the failure means "backend unreachable", not "backend said no". */
export function isOffline(error) {
  return error instanceof NetworkError;
}

/**
 * Pull a human-readable message out of a FastAPI error response.
 * FastAPI returns `{ detail: "..." }` for HTTPException and
 * `{ detail: [{ msg, loc, ... }] }` for 422 validation errors.
 */
function extractDetail(body, status) {
  if (!body) return `Request failed with status ${status}`;
  const { detail } = body;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc.at(-1) : null;
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return `Request failed with status ${status}`;
}

async function request(path, { method = "GET", body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Let a caller-supplied signal also abort our controller.
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // fetch only rejects on network-level failure or abort - never on 4xx/5xx.
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      // The session has run out - tokens last 30 minutes. Telling the user
      // their token is invalid is not useful; the app announces it instead so
      // whoever owns the session can clear it and send them to sign in again.
      window.dispatchEvent(new CustomEvent("auth:expired"));
      throw new ApiError(response.status, "Your session has expired. Please sign in again.", payload);
    }
    throw new ApiError(response.status, extractDetail(payload, response.status), payload);
  }

  return payload;
}

const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  baseUrl: BASE_URL,
};

export default apiClient;

