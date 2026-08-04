export type PermissionCheck = (permission: string) => boolean;

export interface AiModulePageAccess {
  canGenerate: boolean;
  canReadHistory: boolean;
  canReadSource: boolean;
  canWriteReports: boolean;
}

export interface AiModulePageAccessOptions {
  generationPermissions?: readonly string[];
  historyPermission?: string;
}

export function getAiModulePageAccess(
  hasPermission: PermissionCheck,
  sourceReadPermission: string,
  options: AiModulePageAccessOptions = {},
): AiModulePageAccess {
  const canReadSource = hasPermission(sourceReadPermission);
  const canWriteReports = hasPermission("reports:write");
  const canReadHistory = hasPermission(
    options.historyPermission || "reports:read",
  );
  const hasAdditionalGenerationPermissions = (
    options.generationPermissions || []
  ).every(hasPermission);

  return {
    canGenerate:
      canReadSource &&
      canWriteReports &&
      hasAdditionalGenerationPermissions,
    canReadHistory,
    canReadSource,
    canWriteReports,
  };
}

export type OptionalPageResource<T> =
  | {
      data: T;
      error: null;
      status: "loaded";
    }
  | {
      data: null;
      error: null;
      status: "skipped";
    }
  | {
      data: null;
      error: unknown;
      status: "failed";
    };

export async function loadOptionalPageResource<T>(
  enabled: boolean,
  load: () => Promise<T>,
): Promise<OptionalPageResource<T>> {
  if (!enabled) {
    return {
      data: null,
      error: null,
      status: "skipped",
    };
  }

  try {
    return {
      data: await load(),
      error: null,
      status: "loaded",
    };
  } catch (error) {
    return {
      data: null,
      error,
      status: "failed",
    };
  }
}
