"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { TenantProvider } from "@/lib/tenant-context";
import { EventBusProvider } from "@/lib/event-bus";
import { AuditProvider } from "@/lib/audit-context";
import { WebhookProvider } from "@/lib/webhook-context";
import { ToastProvider } from "@/lib/toast-context";

/**
 * AppProviders — composes all application-level context providers.
 *
 * Provider order (outermost → innermost):
 *   1. AuthProvider       — session & user identity (no deps)
 *   2. TenantProvider     — clinic scoping (reads auth conceptually)
 *   3. EventBusProvider   — event emission (no deps)
 *   4. AuditProvider      — audit log (may emit events)
 *   5. WebhookProvider    — webhook ingestion (may emit events)
 *   6. ToastProvider      — UI notifications (leaf, no deps)
 *
 * Do not change order unless there is a clear dependency reason.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <EventBusProvider>
          <AuditProvider>
            <WebhookProvider>
              <ToastProvider>{children}</ToastProvider>
            </WebhookProvider>
          </AuditProvider>
        </EventBusProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
