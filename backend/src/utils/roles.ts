const roleAliasMap: Record<string, string[]> = {
  ADMIN: ["CLINIC_ADMIN"],
  CLINIC_ADMIN: ["ADMIN"],
  CLINICIAN: ["MANAGER"],
  MANAGER: ["CLINICIAN"],
  RECEPTIONIST: ["STAFF"],
  STAFF: ["RECEPTIONIST"],
};

export function getRoleAliases(role: string) {
  if (!role.trim()) return [];

  const normalizedRole = role.toUpperCase();
  return Array.from(new Set([normalizedRole, ...(roleAliasMap[normalizedRole] || [])]));
}

export function roleMatchesAllowedRoles(role: string, allowedRoles: string[]) {
  const userRoles = getRoleAliases(role);

  return allowedRoles.some((allowedRole) => {
    const allowedAliases = getRoleAliases(allowedRole);
    return allowedAliases.some((alias) => userRoles.includes(alias));
  });
}
