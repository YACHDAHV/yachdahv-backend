export const ADMIN_ROLES = ["Super Admin", "Trust & Safety", "Support"] as const;
export type AdminRoleName = typeof ADMIN_ROLES[number];

export const ADMIN_PERMISSIONS = [
  "view_users",
  "manage_users",
  "review_verification",
  "resolve_reports",
  "manage_admins",
  "manage_system",
] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRoleName, AdminPermission[]> = {
  "Super Admin": [...ADMIN_PERMISSIONS],
  "Trust & Safety": ["view_users", "review_verification", "resolve_reports"],
  Support: ["view_users"],
};
