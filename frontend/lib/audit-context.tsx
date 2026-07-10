"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================
// Audit Log Service — tracks all user actions
// Production: writes to audit_log table with clinic_id scoping
// ============================================================

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  clinicId: string;
  changes: Record<string, { from: string; to: string }> | null;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  relativeTime: string;
}

interface AuditContextValue {
  entries: AuditEntry[];
  log: (params: {
    action: string;
    entityType: string;
    entityId: string;
    entityName: string;
    userId?: string;
    userName?: string;
    userRole?: string;
    clinicId?: string;
    changes?: Record<string, { from: string; to: string }>;
  }) => AuditEntry;
  clearEntries: () => void;
}

const AuditContext = createContext<AuditContextValue | null>(null);

let auditCounter = 5000;

// Seed data
const SEED_ENTRIES: AuditEntry[] = [
  {
    id: "aud_001",
    action: "contact.created",
    entityType: "contact",
    entityId: "c_123",
    entityName: "Jessica Williams",
    userId: "user_002",
    userName: "Emma Johnson",
    userRole: "RECEPTIONIST",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "192.168.1.10",
    userAgent: "Chrome/120",
    timestamp: "2026-05-05T09:12:00Z",
    relativeTime: "3 min ago",
  },
  {
    id: "aud_002",
    action: "deadline.created",
    entityType: "deadline",
    entityId: "apt_456",
    entityName: "Website QA - Sarah Johnson",
    userId: "user_002",
    userName: "Emma Johnson",
    userRole: "RECEPTIONIST",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "192.168.1.10",
    userAgent: "Chrome/120",
    timestamp: "2026-05-05T09:08:00Z",
    relativeTime: "7 min ago",
  },
  {
    id: "aud_003",
    action: "contact.updated",
    entityType: "contact",
    entityId: "c_101",
    entityName: "Hannah Brown",
    userId: "user_001",
    userName: "Sarah Smith",
    userRole: "ADMIN",
    clinicId: "clinic_001",
    changes: { status: { from: "New", to: "Contacted" } },
    ipAddress: "192.168.1.20",
    userAgent: "Safari/17",
    timestamp: "2026-05-05T08:45:00Z",
    relativeTime: "30 min ago",
  },
  {
    id: "aud_004",
    action: "call.logged",
    entityType: "call",
    entityId: "call_789",
    entityName: "Outbound — Sarah Johnson",
    userId: "user_001",
    userName: "Sarah Smith",
    userRole: "ADMIN",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "192.168.1.20",
    userAgent: "Safari/17",
    timestamp: "2026-05-05T08:30:00Z",
    relativeTime: "45 min ago",
  },
  {
    id: "aud_005",
    action: "settings.updated",
    entityType: "account",
    entityId: "clinic_001",
    entityName: "Mission Control Demo Account",
    userId: "user_003",
    userName: "Max Sharpe",
    userRole: "SUPER_ADMIN",
    clinicId: "clinic_001",
    changes: { plan: { from: "Starter", to: "Growth" } },
    ipAddress: "10.0.0.1",
    userAgent: "Chrome/120",
    timestamp: "2026-05-05T08:00:00Z",
    relativeTime: "1 hour ago",
  },
  {
    id: "aud_006",
    action: "user.login",
    entityType: "user",
    entityId: "user_003",
    entityName: "Max Sharpe",
    userId: "user_003",
    userName: "Max Sharpe",
    userRole: "SUPER_ADMIN",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "10.0.0.1",
    userAgent: "Chrome/120",
    timestamp: "2026-05-05T07:55:00Z",
    relativeTime: "1 hour ago",
  },
  {
    id: "aud_007",
    action: "deadline.cancelled",
    entityType: "deadline",
    entityId: "apt_111",
    entityName: "Tracking QA - Diana Ross",
    userId: "user_002",
    userName: "Emma Johnson",
    userRole: "RECEPTIONIST",
    clinicId: "clinic_001",
    changes: {
      status: { from: "Scheduled", to: "Cancelled" },
      reason: { from: "", to: "Schedule conflict" },
    },
    ipAddress: "192.168.1.10",
    userAgent: "Chrome/120",
    timestamp: "2026-05-04T16:00:00Z",
    relativeTime: "Yesterday",
  },
  {
    id: "aud_008",
    action: "contact.deleted",
    entityType: "contact",
    entityId: "c_999",
    entityName: "Test Contact",
    userId: "user_003",
    userName: "Max Sharpe",
    userRole: "SUPER_ADMIN",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "10.0.0.1",
    userAgent: "Chrome/120",
    timestamp: "2026-05-04T14:00:00Z",
    relativeTime: "Yesterday",
  },
  {
    id: "aud_009",
    action: "webhook.received",
    entityType: "webhook",
    entityId: "wh_001",
    entityName: "Lead from Google Ads",
    userId: "system",
    userName: "System",
    userRole: "SYSTEM",
    clinicId: "clinic_001",
    changes: null,
    ipAddress: "34.102.136.0",
    userAgent: "Google-Ads-Webhook/1.0",
    timestamp: "2026-05-04T12:00:00Z",
    relativeTime: "Yesterday",
  },
  {
    id: "aud_010",
    action: "manual.spend.entered",
    entityType: "spend",
    entityId: "spend_001",
    entityName: "Google Ads — May Week 1",
    userId: "user_001",
    userName: "Sarah Smith",
    userRole: "ADMIN",
    clinicId: "clinic_001",
    changes: { amount: { from: "0", to: "£2,400" } },
    ipAddress: "192.168.1.20",
    userAgent: "Safari/17",
    timestamp: "2026-05-04T10:00:00Z",
    relativeTime: "Yesterday",
  },
];

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>(SEED_ENTRIES);

  const log = useCallback(
    (params: {
      action: string;
      entityType: string;
      entityId: string;
      entityName: string;
      userId?: string;
      userName?: string;
      userRole?: string;
      clinicId?: string;
      changes?: Record<string, { from: string; to: string }>;
    }): AuditEntry => {
      const entry: AuditEntry = {
        id: `aud_${++auditCounter}`,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName,
        userId: params.userId || "user_003",
        userName: params.userName || "Max Sharpe",
        userRole: params.userRole || "SUPER_ADMIN",
        clinicId: params.clinicId || "clinic_001",
        changes: params.changes || null,
        ipAddress: "192.168.1.xxx",
        userAgent: "Chrome/120",
        timestamp: new Date().toISOString(),
        relativeTime: "Just now",
      };
      setEntries((prev) => [entry, ...prev].slice(0, 500));
      return entry;
    },
    [],
  );

  const clearEntries = useCallback(() => setEntries(SEED_ENTRIES), []);

  return (
    <AuditContext.Provider value={{ entries, log, clearEntries }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}

export function useAuditSafe() {
  return useContext(AuditContext);
}
