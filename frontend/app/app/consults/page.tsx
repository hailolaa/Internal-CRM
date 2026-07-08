"use client";

import {
  PageHeader,
  StatCard,
  Card,
  StatCardSkeleton,
  SkeletonBlock,
  SkeletonLine,
} from "@/components/ui";
import {
  Activity,
  CalendarDays,
  ExternalLink,
  PoundSterling,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type {
  ConsultSummaryRecord,
  ManualConsultRecord,
  PractitionerConversionRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const STAGE_TEMPLATE = [
  { name: "New", count: 0, value: "£0", color: "border-blue-500" },
  { name: "Contacted", count: 0, value: "£0", color: "border-cyan-500" },
  { name: "Consult Booked", count: 0, value: "£0", color: "border-amber-500" },
  {
    name: "Consult Attended",
    count: 0,
    value: "£0",
    color: "border-purple-500",
  },
  {
    name: "Treatment Booked",
    count: 0,
    value: "£0",
    color: "border-indigo-500",
  },
  { name: "Treated", count: 0, value: "£0", color: "border-emerald-500" },
  { name: "Lost", count: 0, value: "£0", color: "border-red-500" },
];

const FILTERS = [
  "All",
  "Booked",
  "Attended",
  "Treatment booked",
  "No-show",
  "Lost",
] as const;

type ConsultFilter = (typeof FILTERS)[number];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toStage(outcome: string) {
  const normalized = outcome.toLowerCase();
  if (normalized.includes("treated")) return "Treated";
  if (normalized.includes("treatment")) return "Treatment Booked";
  if (normalized.includes("attended")) return "Consult Attended";
  if (normalized.includes("book")) return "Consult Booked";
  if (normalized.includes("contact")) return "Contacted";
  if (normalized.includes("lost") || normalized.includes("no_show")) {
    return "Lost";
  }
  return "New";
}

function isNoShow(outcome: string) {
  return outcome.toLowerCase().includes("no_show") || outcome.toLowerCase().includes("no show");
}

function isBooked(outcome: string) {
  return outcome.toLowerCase().includes("book");
}

function needsOutcome(consult: ManualConsultRecord, now: number) {
  if (!consult.date) return false;
  return isBooked(consult.outcome) && new Date(consult.date).getTime() < now;
}

function needsFollowUp(consult: ManualConsultRecord, now: number) {
  return (
    isNoShow(consult.outcome) ||
    Boolean(consult.lostReason) ||
    needsOutcome(consult, now) ||
    String(consult.depositStatus || "").toLowerCase() === "requested"
  );
}

function matchesFilter(consult: ManualConsultRecord, filter: ConsultFilter) {
  const stage = toStage(consult.outcome);
  if (filter === "All") return true;
  if (filter === "Booked") return stage === "Consult Booked";
  if (filter === "Attended") return stage === "Consult Attended";
  if (filter === "Treatment booked") return stage === "Treatment Booked";
  if (filter === "No-show") return isNoShow(consult.outcome);
  if (filter === "Lost") return stage === "Lost";
  return true;
}

function statusBadgeClass(stage: string) {
  switch (stage) {
    case "Treatment Booked":
    case "Treated":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Consult Attended":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "Consult Booked":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Lost":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-[#E7E1DA] bg-[#F6F3EF] text-[#6F6A66]";
  }
}

export default function ConsultsPage() {
  const { session } = useAuth();
  const [consults, setConsults] = useState<ManualConsultRecord[]>([]);
  const [summary, setSummary] = useState<ConsultSummaryRecord | null>(null);
  const [practitioners, setPractitioners] = useState<
    PractitionerConversionRecord[]
  >([]);
  const [activeFilter, setActiveFilter] = useState<ConsultFilter>("All");
  const [selectedConsult, setSelectedConsult] =
    useState<ManualConsultRecord | null>(null);
  const [now] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    Promise.allSettled([
      api.consults.list(session.token),
      api.consults.summary(session.token),
      api.consults.practitionerConversion(session.token),
    ])
      .then(([recordsResult, summaryResult, practitionersResult]) => {
        if (!isMounted) return;

        setConsults(
          recordsResult.status === "fulfilled"
            ? [...recordsResult.value].sort(
                (a, b) =>
                  new Date(b.date || "").getTime() -
                  new Date(a.date || "").getTime(),
              )
            : [],
        );
        setSummary(
          summaryResult.status === "fulfilled" ? summaryResult.value : null,
        );
        setPractitioners(
          practitionersResult.status === "fulfilled"
            ? practitionersResult.value
            : [],
        );

        const failedSources = [
          recordsResult.status === "rejected" ? "consult records" : "",
          summaryResult.status === "rejected" ? "consult summary" : "",
          practitionersResult.status === "rejected"
            ? "practitioner conversion"
            : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length > 0
            ? `Some live consult data could not be loaded: ${failedSources.join(", ")}.`
            : "",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const {
    stages,
    stageCards,
    totalRevenue,
    showRate,
    avgRevenuePerPractitioner,
    insightStats,
  } =
    useMemo(() => {
    const visibleConsults = consults.filter((consult) =>
      matchesFilter(consult, activeFilter),
    );
    const stageRows = STAGE_TEMPLATE.map((stage) => {
      const records = visibleConsults.filter((consult) => toStage(consult.outcome) === stage.name);
      const value = records.reduce((total, consult) => total + consult.revenue, 0);
      return {
        ...stage,
        count: records.length,
        value: formatMoney(value),
      };
    });

    const cards = consults.reduce<
      Record<string, ManualConsultRecord[]>
    >((acc, consult) => {
      if (!matchesFilter(consult, activeFilter)) return acc;
      const stageName = toStage(consult.outcome);
      acc[stageName] ||= [];
      if (acc[stageName].length < 3) {
        acc[stageName].push(consult);
      }
      return acc;
    }, {});

    const revenue = summary?.totalRevenue ?? consults.reduce((total, consult) => total + consult.revenue, 0);
    const totalConsults = summary?.totalConsults ?? consults.length;
    const noShows = summary?.noShowCount ?? consults.filter((consult) => isNoShow(consult.outcome)).length;
    const activePractitioners = practitioners.filter(
      (practitioner) => practitioner.totalConsults > 0,
    ).length;
    const noOutcome = consults.filter((consult) => needsOutcome(consult, now)).length;
    const followUps = consults.filter((consult) => needsFollowUp(consult, now)).length;
    const topPractitioner = [...practitioners]
      .filter((practitioner) => practitioner.totalConsults > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate)[0];

    return {
      stages: stageRows,
      stageCards: cards,
      totalRevenue: revenue,
      insightStats: [
        {
          label: "Needs outcome",
          value: String(noOutcome),
        },
        {
          label: "Follow-up due",
          value: String(followUps),
        },
        {
          label: "No-shows",
          value: String(noShows),
        },
        {
          label: "Top conversion",
          value: topPractitioner
            ? `${topPractitioner.practitioner} ${Math.round(topPractitioner.conversionRate)}%`
            : "—",
        },
      ],
      showRate:
        totalConsults > 0
          ? Math.max(0, Math.round(((totalConsults - noShows) / totalConsults) * 100))
          : 0,
      avgRevenuePerPractitioner:
        activePractitioners > 0 ? revenue / activePractitioners : 0,
    };
  }, [activeFilter, consults, now, practitioners, summary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consult Pipeline"
        subtitle="Track consultations from booked consult through attendance, treatment booking, no-show, and lost outcome."
        icon={Activity}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Treatment Booking Rate"
              value={`${summary?.conversionRate ?? 0}%`}
              sub="Consult → treatment booked"
            />
            <StatCard
              label="Show Rate"
              value={`${showRate}%`}
              sub={`${summary?.noShowCount ?? 0} no-shows logged`}
            />
            <StatCard
              label="Avg. Revenue / Practitioner"
              value={formatMoney(avgRevenuePerPractitioner)}
              sub={`${formatMoney(totalRevenue)} booked revenue`}
            />
          </>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend consults could not be loaded. {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {insightStats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[#E7E1DA] bg-[#FFFCF9] px-4 py-3"
            style={{ boxShadow: "0 1px 4px rgba(27, 29, 34, 0.03)" }}
          >
            <div className="text-xs font-medium text-[#9E9890]">
              {item.label}
            </div>
            <div className="mt-1 text-lg font-bold text-[#1B1D22]">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid #E7E1DA" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1B1D22]">
                Consult Pipeline
              </h2>
              <p className="mt-1 text-sm text-[#6F6A66]">
                Click a card to see notes, links, deposit state, and follow-up
                context.
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter);
                    setSelectedConsult(null);
                  }}
                  className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    activeFilter === filter
                      ? "border-[rgba(96,180,175,0.18)] bg-[rgba(96,180,175,0.08)] text-[#2F8582]"
                      : "border-[#E7E1DA] bg-[#FFFCF9] text-[#6F6A66] hover:bg-[#F6F3EF]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-3 min-w-[900px]">
              {Array.from({ length: 7 }, (_, index) => (
                <div
                  key={index}
                  className="bg-[#F6F3EF] border-t-2 border-[#E7E1DA] rounded-xl p-3"
                >
                  <SkeletonLine className="w-24 h-3 mb-3" />
                  <SkeletonLine className="w-10 h-6 mb-2" />
                  <SkeletonLine className="w-16 h-3 mb-4" />
                  <div className="space-y-2">
                    <SkeletonBlock className="h-14 rounded-lg" />
                    <SkeletonBlock className="h-14 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : consults.length === 0 ? (
            <div className="rounded-xl border border-[#E7E1DA] bg-[#F6F3EF] px-5 py-10 text-center text-sm text-[#6F6A66]">
              No live consult records are available for this clinic yet.
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-3 min-w-[900px]">
              {stages.map((stage) => (
              <div
                key={stage.name}
                className={`bg-[#F6F3EF] border-t-2 ${stage.color} rounded-xl p-3`}
              >
                <div className="text-xs text-[#9E9890] font-medium mb-2">
                  {stage.name}
                </div>
                <div className="text-lg font-bold text-[#1B1D22]">
                  {stage.count}
                </div>
                <div className="text-xs text-emerald-600 mt-1">
                  {stage.value}
                </div>
                {stageCards[stage.name] && (
                  <div className="mt-3 space-y-2">
                    {stageCards[stage.name].map((consult) => {
                      const stageName = toStage(consult.outcome);
                      return (
                      <button
                        key={consult.id}
                        type="button"
                        onClick={() => setSelectedConsult(consult)}
                        className="w-full rounded-lg border border-[#E7E1DA] bg-white p-2 text-left transition-colors hover:border-[#60B4AF] hover:bg-[#FFFCF9]"
                      >
                        <div className="text-xs font-semibold text-[#1B1D22]">
                          {consult.patientName}
                        </div>
                        <div className="mt-1 text-[10px] text-[#9E9890]">
                          {consult.treatment}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-medium ${statusBadgeClass(stageName)}`}
                          >
                            {stageName}
                          </span>
                          {needsOutcome(consult, now) && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                              Needs outcome
                            </span>
                          )}
                          {isNoShow(consult.outcome) && (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
                              No-show
                            </span>
                          )}
                          {String(consult.depositStatus || "").toLowerCase() === "requested" && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                              Deposit requested
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#9E9890]">
                          <span>{consult.practitioner || "Unassigned"}</span>
                          <span>{formatDate(consult.date)}</span>
                        </div>
                        {consult.revenue > 0 && (
                          <div className="mt-1 text-[10px]">
                            <span className="font-semibold text-emerald-600">
                              {formatMoney(consult.revenue)}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {selectedConsult && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <button
            type="button"
            aria-label="Close consult details"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedConsult(null)}
          />
          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-[#FFFCF9] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9890]">
                  Consult details
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1B1D22]">
                  {selectedConsult.patientName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsult(null)}
                className="rounded-xl border border-[#E7E1DA] p-2 text-[#6F6A66] hover:bg-[#F6F3EF]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {[
                {
                  label: "Treatment",
                  value: selectedConsult.treatment || "Consultation",
                  icon: Activity,
                },
                {
                  label: "Practitioner",
                  value: selectedConsult.practitioner || "Unassigned",
                  icon: User,
                },
                {
                  label: "Date",
                  value: formatDate(selectedConsult.date),
                  icon: CalendarDays,
                },
                {
                  label: "Revenue",
                  value:
                    selectedConsult.revenue > 0
                      ? formatMoney(selectedConsult.revenue)
                      : "Not recorded",
                  icon: PoundSterling,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex gap-3 rounded-2xl border border-[#E7E1DA] bg-[#F6F3EF] p-3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 text-[#4A7A8A]" />
                    <div>
                      <div className="text-xs font-medium text-[#9E9890]">
                        {item.label}
                      </div>
                      <div className="text-sm font-semibold text-[#1B1D22]">
                        {item.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-[#E7E1DA] p-4">
              <h3 className="text-sm font-semibold text-[#1B1D22]">
                Outcome context
              </h3>
              <div className="mt-3 space-y-3 text-sm text-[#6F6A66]">
                <p>
                  <span className="font-medium text-[#1B1D22]">Outcome:</span>{" "}
                  {selectedConsult.outcome || "Not recorded"}
                </p>
                <p>
                  <span className="font-medium text-[#1B1D22]">Deposit:</span>{" "}
                  {selectedConsult.depositStatus || "Not recorded"}
                </p>
                <p>
                  <span className="font-medium text-[#1B1D22]">Lost reason:</span>{" "}
                  {selectedConsult.lostReason || "Not recorded"}
                </p>
                <p>
                  <span className="font-medium text-[#1B1D22]">Notes:</span>{" "}
                  {selectedConsult.notes || "No notes yet"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {selectedConsult.contactId && (
                <Link
                  href={`/app/crm/contacts/detail?id=${selectedConsult.contactId}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E7E1DA] bg-white px-3 py-2 text-sm font-medium text-[#4A7A8A] hover:bg-[#F6F3EF]"
                >
                  Open contact <ExternalLink className="h-4 w-4" />
                </Link>
              )}
              {selectedConsult.appointmentId && (
                <Link
                  href="/app/crm/calendar"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E7E1DA] bg-white px-3 py-2 text-sm font-medium text-[#4A7A8A] hover:bg-[#F6F3EF]"
                >
                  Open calendar <ExternalLink className="h-4 w-4" />
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
