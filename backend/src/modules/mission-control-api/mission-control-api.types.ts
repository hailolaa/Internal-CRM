export type MissionControlRecordType =
  | "contact"
  | "client_account"
  | "proposal"
  | "task"
  | "opportunity";

export interface MissionControlUserContext {
  clinicId: string;
  userId: string;
  email?: string | null;
  role?: string | null;
}

export interface MissionControlProvenance {
  source: "mission_control_database" | "runtime_config";
  recordId?: string;
  recordUrl?: string;
  lastSourceUpdate?: string | null;
  lastSyncAt?: string | null;
  dataState: "live" | "cached" | "manual" | "estimated" | "calculated" | "not_applicable";
}

export interface MissionControlSearchResult {
  id: string;
  type: MissionControlRecordType;
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  provenance: MissionControlProvenance;
  metadata: Record<string, unknown>;
}

export interface MissionControlSearchQuery {
  query?: string;
  types?: MissionControlRecordType[];
  limit?: number;
  cursor?: string | null;
}

export interface MissionControlSearchResponse {
  results: MissionControlSearchResult[];
  page: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    returned: number;
  };
  provenance: MissionControlProvenance;
}
