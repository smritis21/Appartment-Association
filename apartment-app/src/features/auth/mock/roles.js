import { ROLES, ROLE_LABELS } from "../../../constants/roles";

export const ROLE_DASHBOARD_PATHS = {
  [ROLES.OWNER]: "/dashboard",
  [ROLES.TENANT]: "/dashboard",
  [ROLES.PRESIDENT]: "/dashboard",
  [ROLES.SECRETARY]: "/dashboard",
  [ROLES.ADMIN]: "/dashboard",
  [ROLES.MAINTENANCE]: "/dashboard",
  [ROLES.SECURITY]: "/dashboard",
};

export const ROLE_COLORS = {
  [ROLES.OWNER]: "success",
  [ROLES.TENANT]: "info",
  [ROLES.PRESIDENT]: "error",
  [ROLES.SECRETARY]: "warning",
  [ROLES.ADMIN]: "secondary",
  [ROLES.MAINTENANCE]: "default",
  [ROLES.SECURITY]: "primary",
};

export { ROLE_LABELS };
