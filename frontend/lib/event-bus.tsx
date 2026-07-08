"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================
// Event Bus — mock event emission system
// In production: writes to `event` table with clinic_id scoping
// ============================================================

export type EventType =
  | "lead.created"
  | "lead.updated"
  | "booking.created"
  | "booking.cancelled"
  | "booking.noshow"
  | "call.logged"
  | "payment.received"
  | "sla.breached"
  | "consult.completed"
  | "treatment.completed"
  | "email.sent"
  | "sms.sent"
  | "user.login"
  | "user.logout"
  | "contact.deleted"
  | "manual.spend.entered"
  | "manual.consult.logged"
  | "webhook.received"
  | "audit.action";

export interface AppEvent {
  id: string;
  eventType: EventType;
  actor: string;
  subject: string;
  detail: string;
  clinicId: string;
  timestamp: string;
  relativeTime: string;
  metadata: Record<string, string>;
}

interface EventBusContextValue {
  events: AppEvent[];
  emit: (
    eventType: EventType,
    actor: string,
    subject: string,
    detail: string,
    clinicId: string,
    metadata?: Record<string, string>,
  ) => AppEvent;
  clearEvents: () => void;
}

const EventBusContext = createContext<EventBusContextValue | null>(null);

let eventCounter = 1000;

function generateId() {
  return `evt_${++eventCounter}`;
}

export function EventBusProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AppEvent[]>([]);

  const emit = useCallback(
    (
      eventType: EventType,
      actor: string,
      subject: string,
      detail: string,
      clinicId: string,
      metadata: Record<string, string> = {},
    ): AppEvent => {
      const event: AppEvent = {
        id: generateId(),
        eventType,
        actor,
        subject,
        detail,
        clinicId,
        timestamp: new Date().toISOString(),
        relativeTime: "Just now",
        metadata,
      };
      setEvents((prev) => [event, ...prev].slice(0, 200));
      return event;
    },
    [],
  );

  const clearEvents = useCallback(() => setEvents([]), []);

  return (
    <EventBusContext.Provider value={{ events, emit, clearEvents }}>
      {children}
    </EventBusContext.Provider>
  );
}

export function useEventBus() {
  const ctx = useContext(EventBusContext);
  if (!ctx) throw new Error("useEventBus must be used within EventBusProvider");
  return ctx;
}

export function useEventBusSafe() {
  return useContext(EventBusContext);
}
