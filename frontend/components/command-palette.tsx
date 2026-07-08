"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CheckSquare,
  FileText,
  Loader2,
  Navigation,
  Search,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  CommandPaletteAction,
  CommandPaletteClinic,
  CommandPaletteRecord,
} from "@/lib/api-types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaletteItem =
  | {
      kind: "action";
      id: string;
      title: string;
      description: string;
      action: CommandPaletteAction;
      badge: string;
    }
  | {
      kind: "record";
      id: string;
      title: string;
      description: string;
      record: CommandPaletteRecord;
      badge: string;
    }
  | {
      kind: "clinic";
      id: string;
      title: string;
      description: string;
      clinic: CommandPaletteClinic;
      badge: string;
    };

const ACTION_ROUTE_OVERRIDES: Record<string, string> = {
  create_lead: "/app/crm/contacts/new",
  log_call: "/app/comms/calls?log=1",
  create_booking: "/app/crm/calendar/new",
  create_task: "/app/crm/tasks/new",
  search_contacts: "/app/crm/contacts",
  open_reports: "/app/reports/overview",
  open_settings: "/app/settings",
};

const NOT_INTEGRATED_ACTION_MESSAGES: Record<string, string> = {
};

function getActionRoute(action: CommandPaletteAction) {
  if (NOT_INTEGRATED_ACTION_MESSAGES[action.id]) return null;
  return ACTION_ROUTE_OVERRIDES[action.id] || action.route || null;
}

function getRecordRoute(record: CommandPaletteRecord) {
  if (record.type === "contact") {
    return `/app/crm/contacts/detail?id=${encodeURIComponent(record.id)}`;
  }

  if (record.type === "appointment") {
    return `/app/crm/calendar?appointmentId=${encodeURIComponent(record.id)}`;
  }

  if (record.type === "task") {
    return `/app/crm/tasks?taskId=${encodeURIComponent(record.id)}`;
  }

  if (record.type === "report") {
    const reportType = String(record.metadata.reportType || "").toLowerCase();
    if (reportType.includes("lead")) return "/app/reports/leads";
    if (reportType.includes("ad")) return "/app/reports/ads";
    if (reportType.includes("no-show") || reportType.includes("noshow")) {
      return "/app/reports/noshows";
    }
    if (reportType.includes("attribution")) return "/app/marketing/attribution";
    return "/app/reports/overview";
  }

  return record.route;
}

function getItemIcon(item: PaletteItem) {
  if (item.kind === "clinic") return Building2;

  if (item.kind === "record") {
    if (item.record.type === "appointment") return Calendar;
    if (item.record.type === "task") return CheckSquare;
    if (item.record.type === "report") return FileText;
    return UserPlus;
  }

  if (item.action.id === "open_settings") return Settings;
  if (item.action.group === "create") return UserPlus;
  return Navigation;
}

function formatActionBadge(action: CommandPaletteAction) {
  if (action.targetType === "clinic_switch") return "Switch";
  return action.group.charAt(0).toUpperCase() + action.group.slice(1);
}

function buildPaletteItems(
  actions: CommandPaletteAction[],
  records: CommandPaletteRecord[],
  clinics: CommandPaletteClinic[],
): PaletteItem[] {
  return [
    ...actions.map((action) => ({
      kind: "action" as const,
      id: `action-${action.id}`,
      title: action.label,
      description: action.disabledReason || action.description,
      action,
      badge: formatActionBadge(action),
    })),
    ...records.map((record) => ({
      kind: "record" as const,
      id: `record-${record.type}-${record.id}`,
      title: record.label,
      description: record.description || `Open ${record.type}`,
      record,
      badge: record.type,
    })),
    ...clinics.map((clinic) => ({
      kind: "clinic" as const,
      id: `clinic-${clinic.id}`,
      title: clinic.name,
      description: clinic.isCurrent
        ? "Current clinic"
        : `${clinic.role} - ${clinic.status}`,
      clinic,
      badge: clinic.isCurrent ? "Current" : "Switch",
    })),
  ];
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { session, switchClinic } = useAuth();
  const token = session?.token;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingClinic, setIsSwitchingClinic] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [palette, setPalette] = useState<Awaited<
    ReturnType<typeof api.commandPalette.search>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPalette = useCallback(
    async (nextQuery: string) => {
      if (!token) {
        setErrorMessage("Sign in again to use the command palette.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextPalette = await api.commandPalette.search(token, {
          query: nextQuery.trim(),
          limit: 8,
          includeDisabled: false,
        });
        setPalette(nextPalette);
        setSelectedIndex(0);
      } catch (error) {
        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "Unable to load command palette results.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      void loadPalette(query);
    }, query.trim() ? 180 : 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, loadPalette, query]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const items = useMemo(() => {
    if (!palette) return [];

    const isSearching = query.trim().length > 0;
    return buildPaletteItems(
      isSearching ? palette.actions : palette.commonActions,
      isSearching ? palette.records : palette.recentRecords,
      palette.clinics,
    );
  }, [palette, query]);

  const hasResults = items.length > 0;
  const safeSelectedIndex = hasResults
    ? Math.min(selectedIndex, items.length - 1)
    : -1;
  const selectedItem = safeSelectedIndex >= 0 ? items[safeSelectedIndex] : null;

  const activateItem = useCallback(
    async (item: PaletteItem) => {
      setStatusMessage(null);
      setErrorMessage(null);

      if (item.kind === "clinic") {
        if (item.clinic.isCurrent) {
          setStatusMessage(`${item.clinic.name} is already selected.`);
          return;
        }

        setIsSwitchingClinic(true);
        const switched = await switchClinic(item.clinic.id);
        setIsSwitchingClinic(false);

        if (!switched) {
          setErrorMessage("Clinic switch failed. Please try again.");
          return;
        }

        onClose();
        router.replace("/app");
        router.refresh();
        return;
      }

      if (item.kind === "record") {
        router.push(getRecordRoute(item.record));
        onClose();
        return;
      }

      if (!item.action.enabled) {
        setStatusMessage(
          item.action.disabledReason || "You do not have access to this action.",
        );
        return;
      }

      if (item.action.targetType === "clinic_switch") {
        setStatusMessage("Select a clinic result below to switch clinics.");
        return;
      }

      const notIntegratedMessage = NOT_INTEGRATED_ACTION_MESSAGES[item.action.id];
      if (notIntegratedMessage) {
        setStatusMessage(notIntegratedMessage);
        return;
      }

      const route = getActionRoute(item.action);
      if (!route) {
        setStatusMessage(
          "This command needs more form details before it can run from the palette.",
        );
        return;
      }

      router.push(route);
      onClose();
    },
    [onClose, router, switchClinic],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) =>
        hasResults ? (current + 1) % items.length : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) =>
        hasResults ? (current - 1 + items.length) % items.length : 0,
      );
      return;
    }

    if (event.key === "Enter" && selectedItem) {
      event.preventDefault();
      void activateItem(selectedItem);
    }
  };

  if (!isOpen) return null;

  const emptyMessage =
    query.trim().length > 0
      ? `No commands or records found for "${query.trim()}".`
      : "No commands or recent records are available.";

  return (
    <div
      data-gsap-overlay
      className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-20 sm:px-4"
      role="presentation"
    >
      <button
        type="button"
        data-gsap-overlay
        aria-label="Close command palette"
        className="absolute inset-0 cursor-default bg-[#151f21]/35 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        data-gsap-popover
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#d8ddda] bg-[#FFFCF9] shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[#d8ddda] px-4 py-3">
          <Search className="h-5 w-5 flex-shrink-0 text-[#5e8a8d]" />
          <input
            ref={inputRef}
            id="command-palette-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setStatusMessage(null);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#151f21] outline-none placeholder:text-[#A8A39B]"
            placeholder="Search commands, contacts, reports, tasks..."
            aria-controls="command-palette-results"
            aria-activedescendant={selectedItem?.id}
          />
          {isLoading && (
            <Loader2
              className="h-4 w-4 animate-spin text-[#60b4af]"
              aria-label="Loading command palette results"
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#5e8a8d] transition-colors hover:bg-[#eaedeb]"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2
              id="command-palette-title"
              className="text-xs font-bold uppercase text-[#5e8a8d]"
            >
              {query.trim() ? "Search results" : "Common actions"}
            </h2>
            <span className="text-[11px] font-medium text-[#A8A39B]">
              Enter to open
            </span>
          </div>

          {errorMessage && (
            <div
              data-gsap-reveal
              className="mb-3 flex items-start gap-2 rounded-xl border border-[#b7672e]/20 bg-[#b7672e]/10 px-3 py-2 text-sm text-[#7a3f16]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div
              data-gsap-reveal
              className="mb-3 rounded-xl border border-[#60b4af]/25 bg-[#60b4af]/10 px-3 py-2 text-sm text-[#346866]"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          <div
            id="command-palette-results"
            role="listbox"
            aria-label="Command palette results"
            className="max-h-[24rem] overflow-y-auto"
          >
            {!hasResults && !isLoading && (
              <div
                data-gsap-reveal
                className="rounded-xl border border-dashed border-[#d8ddda] px-4 py-8 text-center"
              >
                <p className="text-sm font-semibold text-[#151f21]">
                  {emptyMessage}
                </p>
                <p className="mt-1 text-xs text-[#5e8a8d]">
                  Try a contact name, report, task, or app page.
                </p>
              </div>
            )}

            {items.map((item, index) => {
              const Icon = getItemIcon(item);
              const isSelected = index === safeSelectedIndex;
              const isUnavailable =
                item.kind === "action" && !item.action.enabled;
              const isBusy =
                item.kind === "clinic" &&
                isSwitchingClinic &&
                !item.clinic.isCurrent;

              return (
                <button
                  key={item.id}
                  id={item.id}
                  data-gsap-list-item
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isUnavailable || isBusy}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void activateItem(item)}
                  className="mb-1 flex min-h-[4rem] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? "rgba(96, 180, 175, 0.1)"
                      : "transparent",
                    opacity: isUnavailable ? 0.68 : 1,
                  }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(96, 180, 175, 0.18)"
                        : "#eaedeb",
                    }}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#60b4af]" />
                    ) : (
                      <Icon className="h-4 w-4 text-[#5e8a8d]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#151f21]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#5e8a8d]">
                      {item.description}
                    </span>
                  </span>
                  <span className="hidden flex-shrink-0 rounded-full border border-[#d8ddda] px-2 py-1 text-[10px] font-semibold uppercase text-[#5e8a8d] sm:inline-flex">
                    {item.badge}
                  </span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#A8A39B]" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
