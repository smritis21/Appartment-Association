export const ROLES = {
  ADMIN: "admin",
  SECRETARY: "secretary",
  PRESIDENT: "president",
  OWNER: "owner",
  TENANT: "tenant",
  SECURITY: "security",
  MAINTENANCE: "maintenance",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.SECRETARY]: "Secretary",
  [ROLES.PRESIDENT]: "President",
  [ROLES.OWNER]: "Owner",
  [ROLES.TENANT]: "Tenant",
  [ROLES.SECURITY]: "Security Guard",
  [ROLES.MAINTENANCE]: "Maintenance Staff",
};

export const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.SECRETARY, ROLES.PRESIDENT];
export const RESIDENT_ROLES = [ROLES.OWNER, ROLES.TENANT];
