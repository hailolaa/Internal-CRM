const roleAliasMap: Record<string, string[]> = {
  ADMIN: ["CLINIC_ADMIN", "MANAGER"],
  CLINIC_ADMIN: ["ADMIN", "MANAGER"],
  MANAGER: ["ADMIN", "CLINIC_ADMIN"],
  SALES: ["RECEPTIONIST", "STAFF"],
  RECEPTIONIST: ["SALES", "STAFF"],
  STAFF: ["SALES", "RECEPTIONIST"],
  DELIVERY: ["CLINICIAN", "PRACTITIONER"],
  CLINICIAN: ["DELIVERY", "PRACTITIONER"],
  PRACTITIONER: ["DELIVERY", "CLINICIAN"],
  INTERNAL_VIEWER: ["READ_ONLY", "AGENCY_ANALYST", "AGENCY", "ANALYST"],
  READ_ONLY: ["INTERNAL_VIEWER", "AGENCY_ANALYST", "AGENCY", "ANALYST"],
  AGENCY_ANALYST: ["INTERNAL_VIEWER", "READ_ONLY", "AGENCY", "ANALYST"],
  AGENCY: ["INTERNAL_VIEWER", "READ_ONLY", "AGENCY_ANALYST", "ANALYST"],
  ANALYST: ["INTERNAL_VIEWER", "READ_ONLY", "AGENCY_ANALYST", "AGENCY"],
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
