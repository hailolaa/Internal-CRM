"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Plus,
  ClipboardList,
  PoundSterling,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Card,
  AlertBanner,
  Avatar,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import { SearchInput, FilterTabs } from "@/components/ui/forms";
import {
  DataTable,
  TableRow,
  TableCell,
  MoreButton,
} from "@/components/ui/tables";
import { TreatmentPlanModal } from "@/components/treatment-plans/treatment-plan-modal";
import { api } from "@/lib/api-client";
import type { TreatmentPlanRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type TreatmentPlan = {
  id: string;
  contact: string;
  avatar: string;
  treatment: string;
  items: string[];
  totalValue: number;
  paid: number;
  outstanding: number;
  status: string;
  sessions: number;
  sessionsCompleted: number;
  createdAt: string;
  nextSession: string | null;
  practitioner: string;
};

type TreatmentPlanPayload = {
  contact: string;
  treatment: string;
  items: string[];
  totalValue: number;
  paid: number;
  status: string;
  sessions: number;
  sessionsCompleted: number;
  nextSession: string | null;
  practitioner: string;
};

type TreatmentPlanUpdatePayload = Partial<
  Pick<
    TreatmentPlan,
    | "contact"
    | "avatar"
    | "treatment"
    | "items"
    | "totalValue"
    | "paid"
    | "outstanding"
    | "status"
    | "sessions"
    | "sessionsCompleted"
    | "nextSession"
    | "practitioner"
  >
>;

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toTreatmentPlan(record: TreatmentPlanRecord): TreatmentPlan {
  return {
    id: record.id,
    contact: record.contact,
    avatar: record.avatar || record.contact.slice(0, 2).toUpperCase(),
    treatment: record.treatment,
    items: record.items,
    totalValue: record.totalValue,
    paid: record.paid,
    outstanding: record.outstanding,
    status: record.status,
    sessions: record.sessions,
    sessionsCompleted: record.sessionsCompleted,
    createdAt: formatDate(record.createdAt) || "—",
    nextSession: formatDate(record.nextSession),
    practitioner: record.practitioner || "Unassigned",
  };
}

async function fetchTreatmentPlans(token: string) {
  const records = await api.treatmentPlans.list(token);
  return records.map(toTreatmentPlan);
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-400" },
  completed: { label: "Completed", color: "bg-blue-500/10 text-blue-400" },
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-400" },
  overdue: { label: "Overdue", color: "bg-red-500/10 text-red-400" },
};

const FILTER_TABS = ["All", "Active", "Completed", "Draft"];

export default function TreatmentPlansPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [openActionsPlanId, setOpenActionsPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    fetchTreatmentPlans(token)
      .then((rows) => {
        if (!isMounted) return;
        setLoadError("");
        setPlans(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load treatment plans from the backend.",
        );
        setPlans([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const totalValue = plans.reduce((acc, p) => acc + p.totalValue, 0);
  const totalPaid = plans.reduce((acc, p) => acc + p.paid, 0);
  const totalOutstanding = plans.reduce((acc, p) => acc + p.outstanding, 0);
  const activePlans = plans.filter((p) => p.status === "active").length;

  const practitionerSummaries = useMemo(() => {
    const summaries = new Map<
      string,
      { name: string; plans: number; value: number; collected: number }
    >();

    plans.forEach((plan) => {
      const current = summaries.get(plan.practitioner) || {
        name: plan.practitioner,
        plans: 0,
        value: 0,
        collected: 0,
      };
      current.plans += 1;
      current.value += plan.totalValue;
      current.collected += plan.paid;
      summaries.set(plan.practitioner, current);
    });

    return Array.from(summaries.values());
  }, [plans]);

  const filtered = plans.filter((plan) => {
    const matchesSearch =
      !searchQuery ||
      plan.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.treatment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === "all" || plan.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleCreatePlan = async (payload: TreatmentPlanPayload) => {
    if (!token) throw new Error("Sign in to create treatment plans.");

    await api.treatmentPlans.create(token, payload);
    const rows = await fetchTreatmentPlans(token);
    setPlans(rows);
    setShowModal(false);
    setSelectedPlan(null);
    setActionError("");
    setActionMessage(`${payload.treatment} created for ${payload.contact}.`);
  };

  const updatePlan = async (
    plan: TreatmentPlan,
    payload: TreatmentPlanUpdatePayload,
    message: string,
  ) => {
    if (!token) return;

    setUpdatingPlanId(plan.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.treatmentPlans.update(token, plan.id, payload);
      setPlans((current) =>
        current.map((item) =>
          item.id === plan.id
            ? {
                ...item,
                ...payload,
                outstanding:
                  payload.outstanding !== undefined
                    ? payload.outstanding
                    : payload.paid !== undefined || payload.totalValue !== undefined
                      ? Math.max(
                          (payload.totalValue ?? item.totalValue) -
                            (payload.paid ?? item.paid),
                          0,
                        )
                      : item.outstanding,
              }
            : item,
        ),
      );
      setActionMessage(message);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update treatment plan.",
      );
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const archivePlan = async (plan: TreatmentPlan) => {
    if (!token) return;

    setUpdatingPlanId(plan.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.treatmentPlans.remove(token, plan.id);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setOpenActionsPlanId(null);
      setActionMessage(`${plan.treatment} archived.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to archive treatment plan.",
      );
    } finally {
      setUpdatingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treatment Plans"
        subtitle="Track multi-session treatment plans and outstanding value."
        icon={ClipboardList}
        iconColor="text-emerald-400"
        iconBg="bg-emerald-500/10"
        right={
          <button
            onClick={() => {
              setSelectedPlan(null);
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Active Plans"
              value={String(activePlans)}
              icon={ClipboardList}
              color="emerald"
            />
            <StatCard
              label="Total Plan Value"
              value={`£${totalValue.toLocaleString()}`}
              icon={PoundSterling}
              color="teal"
            />
            <StatCard
              label="Collected"
              value={`£${totalPaid.toLocaleString()}`}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              label="Outstanding"
              value={`£${totalOutstanding.toLocaleString()}`}
              icon={AlertTriangle}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Alert */}
      {totalOutstanding > 0 && (
        <AlertBanner
          icon={TrendingUp}
          title={`£${totalOutstanding.toLocaleString()} outstanding across ${plans.filter((p) => p.outstanding > 0).length} plans`}
          description="Review outstanding balances and follow up with patients who have upcoming sessions."
          variant="info"
        />
      )}

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend treatment plans could not be loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner
          icon={CheckCircle}
          title={actionMessage}
          variant="success"
        />
      )}

      {actionError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Treatment plan action failed"
          description={actionError}
          variant="error"
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by patient or treatment..."
          className="flex-1 max-w-md"
        />
        <FilterTabs
          tabs={FILTER_TABS}
          active={activeFilter}
          onChange={setActiveFilter}
        />
      </div>

      {/* Table */}
      <DataTable
        headers={[
          { label: "Patient" },
          { label: "Treatment Plan" },
          { label: "Sessions", className: "hidden md:table-cell" },
          { label: "Total Value" },
          { label: "Paid", className: "hidden lg:table-cell" },
          { label: "Outstanding" },
          { label: "Status" },
          { label: "Next Session", className: "hidden xl:table-cell" },
          { label: "" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 6 }, (_, index) => (
            <TableRowSkeleton key={index} columns={9} />
          ))}
        {!isLoading && filtered.map((plan) => {
          const progressPct =
            plan.sessions > 0
              ? Math.round((plan.sessionsCompleted / plan.sessions) * 100)
              : 0;
          const sc = statusConfig[plan.status] || statusConfig.draft;
          return (
            <Fragment key={plan.id}>
              <TableRow
                onClick={() => {
                  setSelectedPlan(plan);
                  setShowModal(true);
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={plan.contact} size="sm" />
                    <div>
                      <p className="font-medium text-sm">{plan.contact}</p>
                      <p className="text-xs text-gray-500">{plan.practitioner}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{plan.treatment}</p>
                  <p className="text-xs text-gray-500">
                    {plan.items.length} items
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div>
                    <p className="text-sm font-medium">
                      {plan.sessionsCompleted}/{plan.sessions}
                    </p>
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-white">
                    £{plan.totalValue.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-green-400 font-medium">
                    £{plan.paid.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  {plan.outstanding > 0 ? (
                    <span className="text-amber-400 font-medium">
                      £{plan.outstanding.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full ${sc.color}`}>
                    {sc.label}
                  </span>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <span className="text-sm text-gray-400">
                    {plan.nextSession || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div onClick={(event) => event.stopPropagation()}>
                    <MoreButton
                      label={`More options for ${plan.treatment}`}
                      onClick={() =>
                        setOpenActionsPlanId((current) =>
                          current === plan.id ? null : plan.id,
                        )
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
              {openActionsPlanId === plan.id && (
                <TableRow>
                  <td colSpan={9} className="px-6 py-4">
                    <div className="flex flex-wrap gap-2 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF8F5] p-3">
                      <button
                        onClick={() =>
                          void updatePlan(
                            plan,
                            { status: "active" },
                            `${plan.treatment} marked active.`,
                          )
                        }
                        disabled={updatingPlanId === plan.id || plan.status === "active"}
                        className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        Mark Active
                      </button>
                      <button
                        onClick={() =>
                          void updatePlan(
                            plan,
                            { status: "draft" },
                            `${plan.treatment} moved to draft.`,
                          )
                        }
                        disabled={updatingPlanId === plan.id || plan.status === "draft"}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-[#5e8a8d] hover:bg-[#eaedeb] disabled:opacity-50"
                      >
                        Mark Draft
                      </button>
                      <button
                        onClick={() =>
                          void updatePlan(
                            plan,
                            {
                              status: "completed",
                              sessionsCompleted: plan.sessions,
                            },
                            `${plan.treatment} marked completed.`,
                          )
                        }
                        disabled={
                          updatingPlanId === plan.id || plan.status === "completed"
                        }
                        className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/15 disabled:opacity-50"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() =>
                          void updatePlan(
                            plan,
                            {
                              sessionsCompleted: Math.min(
                                plan.sessionsCompleted + 1,
                                plan.sessions,
                              ),
                            },
                            `Logged a session for ${plan.treatment}.`,
                          )
                        }
                        disabled={
                          updatingPlanId === plan.id ||
                          plan.sessionsCompleted >= plan.sessions
                        }
                        className="rounded-xl bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.15)] disabled:opacity-50"
                      >
                        Log Session
                      </button>
                      <button
                        onClick={() =>
                          void updatePlan(
                            plan,
                            {
                              paid: plan.totalValue,
                              outstanding: 0,
                            },
                            `${plan.treatment} marked paid.`,
                          )
                        }
                        disabled={updatingPlanId === plan.id || plan.outstanding === 0}
                        className="rounded-xl bg-green-500/10 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-500/15 disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => void archivePlan(plan)}
                        disabled={updatingPlanId === plan.id}
                        className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </TableRow>
              )}
            </Fragment>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <TableRow>
            <td className="px-6 py-8 text-sm text-gray-500" colSpan={9}>
              No treatment plans loaded yet.
            </td>
          </TableRow>
        )}
      </DataTable>

      {/* Value Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PoundSterling className="w-5 h-5 text-teal-400" /> Value by
            Practitioner
          </h3>
          <div className="space-y-4">
            {practitionerSummaries.map((p) => {
              const pct = Math.round((p.collected / p.value) * 100);
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{p.plans} plans</span>
                      <span className="text-teal-400 font-medium">
                        £{p.value.toLocaleString()}
                      </span>
                      <span className="text-green-400">{pct}% collected</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" /> Plan Summary
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Total Plans",
                value: plans.length,
                color: "text-white",
              },
              {
                label: "Active",
                value: plans.filter((p) => p.status === "active").length,
                color: "text-green-400",
              },
              {
                label: "Completed",
                value: plans.filter((p) => p.status === "completed").length,
                color: "text-blue-400",
              },
              {
                label: "Draft",
                value: plans.filter((p) => p.status === "draft").length,
                color: "text-gray-400",
              },
              {
                label: "Total Sessions",
                value: plans.reduce((a, p) => a + p.sessions, 0),
                color: "text-white",
              },
              {
                label: "Sessions Done",
                value: plans.reduce((a, p) => a + p.sessionsCompleted, 0),
                color: "text-emerald-400",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className={`font-semibold ${item.color}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Modal */}
      {showModal && (
        <TreatmentPlanModal
          plan={selectedPlan}
          onCreate={handleCreatePlan}
          onClose={() => {
            setShowModal(false);
            setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
}
