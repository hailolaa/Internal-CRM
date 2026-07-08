// ============================================================
// Shared type definitions for the entire application
// ============================================================

import type { LucideIcon } from "lucide-react";

// --- Auth / Tenancy ---

/** User roles — single source of truth for both auth-context and tenant-context. */
export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "MANAGER"
  | "CLINICIAN"
  | "RECEPTIONIST"
  | "AGENCY_ANALYST";

/**
 * AuthUser — unified shape used by both AuthProvider and TenantProvider.
 *
 * Fields present in auth-context only are marked optional so tenant-context
 * can use the same type without widening.  Both current consumers are safe:
 *   - auth-context always populates every field.
 *   - tenant-context omits `clinicName` and `avatar`.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clinicId: string;
  permissions: string[];
  emailVerifiedAt?: string | null;
  /** Present in auth-context; absent in tenant-context. */
  clinicName?: string;
  /** Present in auth-context; absent in tenant-context. */
  avatar?: string;
}

// --- UI Primitives ---

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "premium";

export type ColorAccent =
  | "teal"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "green"
  | "red"
  | "cyan"
  | "emerald"
  | "indigo"
  | "pink"
  | "fuchsia"
  | "sky"
  | "purple"
  | "orange";

export interface StatCardData {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  sub?: string;
  color?: ColorAccent;
  icon?: LucideIcon;
}

export interface BadgeConfig {
  label: string;
  variant: StatusVariant;
}

// --- Navigation ---

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: "coming-soon" | "premium";
}

export interface NavSection {
  title: string;
  colorClass: string;
  items: NavItem[];
}

// --- Forms ---

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "url"
    | "date"
    | "time"
    | "password"
    | "textarea"
    | "select";
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  rows?: number;
}

// --- AI Agents ---

export interface AgentConfig {
  key: string;
  name: string;
  character: string;
  title: string;
  emoji: string;
  image: string;
  description: string;
  outcome: string;
  inputs: string[];
  gradient: string;
  border: string;
  accent: string;
  bg: string;
  enabled: boolean;
}

// --- Feature Gate ---

export interface FeatureGateFeature {
  name: string;
  desc: string;
  icon: LucideIcon;
}

export interface FeatureGateConfig {
  title: string;
  icon: LucideIcon;
  phase: string;
  description: string;
  features: FeatureGateFeature[];
  ctaLabel: string;
  accentColor: "purple" | "amber";
}

// --- Pipeline ---

export interface PipelineDeal {
  id: string;
  name: string;
  value: string;
  treatment: string;
  source: string;
  daysInStage: number;
  avatar: string;
  email: string;
  phone: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  deals: PipelineDeal[];
}

// --- Contacts ---

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  tags: string[];
  lastContact: string;
  value: string;
}

// --- Compliance ---

export interface ComplianceItem {
  id: string;
  title: string;
  status: "complete" | "action_required" | "expiring_soon" | "pending";
  lastUpdated: string;
  dueDate: string | null;
  category: string;
}

// --- Generic list item ---

export interface ListItem {
  id: string;
  [key: string]: unknown;
}

// --- Callback types ---

export type VoidCallback = () => void;
export type StringCallback = (value: string) => void;
