/**
 * authService.js - BE-21.
 *
 * Talks to the Authentication & Accounts API and translates between the
 * backend's snake_case contract and the camelCase user shape the rest of
 * the app (AuthContext, ProfilePage, mock/roles) already expects.
 *
 * Endpoints used:
 *   POST /auth/register         - create a pending account
 *   POST /auth/login            - authenticate, returns a JWT
 *   POST /auth/forgot-password  - issue a reset token (no email infra yet)
 *   POST /auth/reset-password   - consume token, set new password
 *   POST /auth/change-password  - change password (authenticated)
 *   GET  /auth/profile          - read own profile (authenticated)
 *   PUT  /auth/profile          - update own profile (authenticated; full_name only)
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

/** Backend UserProfileOut -> UI user shape (matches mock/users.js fields). */
export function toUiUser(dto) {
  return {
    id: dto.user_id,
    name: dto.full_name ?? "",
    email: dto.email ?? "",
    role: dto.role,
    accountStatus: dto.account_status,
    residentId: dto.resident_id ?? null,
    avatar: null,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function register(payload, options = {}) {
  const data = await apiClient.post(
    "/auth/register",
    {
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
      role: payload.role,
    },
    options
  );
  return toUiUser(data);
}

/** Returns { user, token } - caller (AuthContext) decides how to store them. */
export async function login(email, password, options = {}) {
  const data = await apiClient.post("/auth/login", { email, password }, options);
  return {
    token: data.access_token,
    user: {
      id: data.user_id,
      role: data.role,
      accountStatus: data.account_status,
    },
  };
}

export async function forgotPassword(email, options = {}) {
  return apiClient.post("/auth/forgot-password", { email }, options);
}

export async function resetPassword(token, newPassword, options = {}) {
  return apiClient.post(
    "/auth/reset-password",
    { token, new_password: newPassword },
    options
  );
}

export async function changePassword(currentPassword, newPassword, options = {}) {
  return apiClient.post(
    "/auth/change-password",
    { current_password: currentPassword, new_password: newPassword },
    options
  );
}

export async function fetchProfile(options = {}) {
  const data = await apiClient.get("/auth/profile", options);
  return toUiUser(data);
}

export async function updateProfile(payload, options = {}) {
  const data = await apiClient.put(
    "/auth/profile",
    { full_name: payload.fullName },
    options
  );
  return toUiUser(data);
}

