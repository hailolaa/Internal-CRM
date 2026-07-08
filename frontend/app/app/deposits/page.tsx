"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle,
  PoundSterling,
  TrendingUp,
  Shield,
  Loader2,
  MessageSquare,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Card,
  AlertBanner,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import { DataTable, TableRow, TableCell } from "@/components/ui/tables";
import { FilterTabs } from "@/components/ui/forms";
import { DEPOSIT_STATUS_CONFIG } from "@/lib/data/deposits";
import { api } from "@/lib/api-client";
import type { DepositRecordResponse } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type DepositRecord = DepositRecordResponse & {
  appointmentDateFormatted: string;
  paidDateFormatted: string | null;
  practitionerName: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toDepositRecord(record: DepositRecordResponse): DepositRecord {
  return {
    ...record,
    appointmentDateFormatted: formatDate(record.appointmentDate),
    paidDateFormatted: record.paidDate ? formatDate(record.paidDate) : null,
    practitionerName: record.practitioner || "Unassigned",
  };
}

export default function DepositTrackingPage() {
  const { session } = useAuth();
  const [checkoutStatus] = useState<"success" | "canceled" | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") return "success";
    if (params.get("canceled") === "true") return "canceled";
    return null;
  });
  const [activeTab, setActiveTab] = useState("all");
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    api.deposits
      .list(session.token)
      .then((records) => {
        if (!isMounted) return;
        const rows = records.map(toDepositRecord);
        setLoadError("");
        setDeposits(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load deposits from the backend.",
        );
        setDeposits([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const filtered = deposits.filter((d) => {
    if (activeTab === "all") return true;
    return d.status === activeTab;
  });

  const knownAppointments = deposits.filter((d) => d.showedUp !== null);
  const paidKnownAppointments = knownAppointments.filter((d) => d.depositPaid);
  const unpaidKnownAppointments = knownAppointments.filter(
    (d) => !d.depositPaid && d.status !== "waived",
  );
  const paidShowRate = paidKnownAppointments.length
    ? Math.round(
        (paidKnownAppointments.filter((d) => d.showedUp).length /
          paidKnownAppointments.length) *
          100,
      )
    : null;
  const unpaidShowRate = unpaidKnownAppointments.length
    ? Math.round(
        (unpaidKnownAppointments.filter((d) => d.showedUp).length /
          unpaidKnownAppointments.length) *
          100,
      )
    : null;
  const showRateImpact =
    paidShowRate !== null && unpaidShowRate !== null
      ? paidShowRate - unpaidShowRate
      : null;

  const totalDeposits = deposits
    .filter((d) => d.depositPaid)
    .reduce((a, d) => a + d.depositAmount, 0);
  const paidCount = deposits.filter((d) => d.depositPaid).length;
  const unpaidCount = deposits.filter(
    (d) => !d.depositPaid && d.status !== "waived",
  ).length;
  const coverageRate =
    deposits.length > 0 ? Math.round((paidCount / deposits.length) * 100) : 0;
  const policyInsights = useMemo(() => {
    const groups = new Map<
      string,
      {
        treatment: string;
        count: number;
        paid: number;
        requested: number;
        amount: number;
        knownShows: number;
        showed: number;
      }
    >();

    deposits.forEach((deposit) => {
      const current = groups.get(deposit.treatment) || {
        treatment: deposit.treatment,
        count: 0,
        paid: 0,
        requested: 0,
        amount: 0,
        knownShows: 0,
        showed: 0,
      };
      current.count += 1;
      current.paid += deposit.depositPaid ? 1 : 0;
      current.requested += deposit.depositRequested ? 1 : 0;
      current.amount += deposit.depositAmount;
      if (deposit.showedUp !== null) {
        current.knownShows += 1;
        current.showed += deposit.showedUp ? 1 : 0;
      }
      groups.set(deposit.treatment, current);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((group) => {
        const coverage = Math.round((group.paid / group.count) * 100);
        const showRate = group.knownShows
          ? Math.round((group.showed / group.knownShows) * 100)
          : null;
        const averageDeposit = group.amount / group.count;

        return {
          ...group,
          coverage,
          showRate,
          averageDeposit,
          recommendation:
            coverage < 50
              ? "Low deposit coverage. Review request workflow for this treatment."
              : showRate !== null && showRate < 85
                ? "Show rate is below target. Tighten reminders and confirmation follow-up."
                : "Policy is performing from available live records.",
        };
      });
  }, [deposits]);

  const handleRequestDeposit = async (depId: string) => {
    if (!session?.token) return;
    const deposit = deposits.find((item) => item.id === depId);
    if (!deposit) return;
    if (deposit.depositAmount <= 0) {
      setActionError("This record has no deposit amount to request.");
      return;
    }

    setRequestingId(depId);
    setActionError("");
    try {
      const checkout = await api.deposits.createSession(session.token, {
        contactName: deposit.contact,
        treatment: deposit.treatment,
        depositAmount: deposit.depositAmount,
        successUrl: `${window.location.origin}/app/deposits/?success=true&sourceDepositId=${encodeURIComponent(depId)}`,
        cancelUrl: `${window.location.origin}/app/deposits/?canceled=true&sourceDepositId=${encodeURIComponent(depId)}`,
      });
      setDeposits((prev) =>
        prev.map((d) =>
          d.id === depId
            ? { ...d, depositRequested: true, status: "requested" }
            : d,
        ),
      );
      if (checkout.url) {
        window.location.assign(checkout.url);
      } else {
        setActionError("Stripe did not return a checkout URL.");
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not create the Stripe deposit checkout session.",
      );
    } finally {
      setRequestingId(null);
    }
  };

  const handleSendReminder = async (depId: string) => {
    if (!session?.token) return;
    setRemindingId(depId);
    setActionError("");
    try {
      await api.deposits.update(session.token, depId, {
        reminderSent: true,
      });
      setDeposits((prev) =>
        prev.map((d) => (d.id === depId ? { ...d, reminderSent: true } : d)),
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not send the deposit reminder.",
      );
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deposit Enforcement Tracking"
        subtitle="Track deposit collection, enforcement policies, and impact on show rates."
        icon={CreditCard}
        iconColor="text-emerald-400"
        iconBg="bg-emerald-500/10"
      />

      <AlertBanner
        icon={CreditCard}
        title="Live deposit tracking is connected"
        description="Deposit records, request flags, reminder flags and Stripe checkout-session creation are wired to the backend."
        variant="info"
      />

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend deposits could not be loaded. {loadError}
        </div>
      )}

      {checkoutStatus === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Stripe checkout completed. Payment status will update after the Stripe webhook is processed.
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Stripe checkout was cancelled. No deposit payment was recorded.
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Deposit action failed. {actionError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Deposits Collected"
              value={formatMoney(totalDeposits)}
              icon={PoundSterling}
              color="emerald"
            />
            <StatCard
              label="Coverage Rate"
              value={`${coverageRate}%`}
              sub={`${paidCount} of ${deposits.length} bookings`}
              icon={Shield}
              color="teal"
            />
            <StatCard
              label="Unpaid / At Risk"
              value={String(unpaidCount)}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              label="Show Rate Impact"
              value={
                showRateImpact !== null
                  ? `${showRateImpact > 0 ? "+" : ""}${showRateImpact}%`
                  : "—"
              }
              sub={
                showRateImpact !== null
                  ? `${paidShowRate}% paid vs ${unpaidShowRate}% unpaid`
                  : "Needs attended deposit history"
              }
              icon={TrendingUp}
              color="green"
            />
          </>
        )}
      </div>

      {/* Deposit Policy Recommendations */}
      <Card>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-400" /> Deposit Policy by
          Treatment
        </h3>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 rounded-lg border border-white/5 bg-white/5 skeleton-shimmer"
              />
            ))}
          </div>
        ) : policyInsights.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/5 p-4 text-sm text-gray-500">
            No live deposit records are available to generate treatment policy
            insights yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {policyInsights.map((policy) => (
            <div
              key={policy.treatment}
              className="p-4 bg-white/5 rounded-lg border border-white/5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{policy.treatment}</span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatMoney(policy.averageDeposit)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                Coverage: {policy.coverage}% · Show rate:{" "}
                {policy.showRate !== null ? `${policy.showRate}%` : "Unknown"}
              </p>
              <p className="text-xs text-gray-400">{policy.recommendation}</p>
            </div>
            ))}
          </div>
        )}
      </Card>

      <FilterTabs
        tabs={["All", "Paid", "Requested", "Unpaid", "Failed", "Waived"]}
        active={activeTab}
        onChange={setActiveTab}
      />

      <DataTable
        headers={[
          { label: "Contact" },
          { label: "Treatment" },
          { label: "Appointment", className: "hidden md:table-cell" },
          { label: "Deposit" },
          { label: "Status" },
          { label: "Paid Date", className: "hidden lg:table-cell" },
          { label: "Showed Up", className: "hidden md:table-cell" },
          { label: "Actions" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 6 }, (_, index) => (
            <TableRowSkeleton key={index} columns={8} />
          ))}
        {!isLoading && filtered.map((dep) => {
          const sc = DEPOSIT_STATUS_CONFIG[dep.status];
          const isRequesting = requestingId === dep.id;
          const isReminding = remindingId === dep.id;
          const showActions =
            ["unpaid", "requested", "failed"].includes(dep.status) &&
            dep.showedUp === null;

          return (
            <TableRow key={dep.id}>
              <TableCell className="font-medium text-sm">
                {dep.contact}
              </TableCell>
              <TableCell className="text-sm text-gray-400">
                {dep.treatment}
              </TableCell>
              <TableCell className="text-sm text-gray-400 hidden md:table-cell">
                {dep.appointmentDateFormatted}
              </TableCell>
              <TableCell>
                <span
                  className={`font-semibold text-sm ${dep.depositAmount > 0 ? "text-white" : "text-gray-500"}`}
                >
                  {dep.depositAmount > 0 ? formatMoney(dep.depositAmount) : "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-1 rounded-full ${sc?.color || "bg-gray-500/10 text-gray-400"}`}>
                  {sc?.label || dep.status}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500 hidden lg:table-cell">
                {dep.paidDateFormatted || "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {dep.showedUp === null ? (
                  <span className="text-xs text-gray-600">Upcoming</span>
                ) : dep.showedUp ? (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Yes
                  </span>
                ) : (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No-Show
                  </span>
                )}
              </TableCell>
              <TableCell>
                {showActions ? (
                  <div className="flex items-center gap-2">
                    {!dep.depositRequested ? (
                      <button
                        onClick={() => handleRequestDeposit(dep.id)}
                        disabled={isRequesting}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                      >
                        {isRequesting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />{" "}
                            Sending...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3 h-3" /> Request
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-teal-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Requested
                      </span>
                    )}

                    {!dep.reminderSent ? (
                      <button
                        onClick={() => handleSendReminder(dep.id)}
                        disabled={isReminding}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                      >
                        {isReminding ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />{" "}
                            Sending...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3 h-3" /> Remind
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Sent
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <TableRow>
            <td className="px-6 py-8 text-sm text-gray-500" colSpan={8}>
              No deposit records loaded yet.
            </td>
          </TableRow>
        )}
      </DataTable>
    </div>
  );
}
