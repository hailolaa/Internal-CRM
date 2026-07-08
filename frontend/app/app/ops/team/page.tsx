"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import {
  AlertBanner,
  Avatar,
  Badge,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  SearchInput,
  StatCard,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { getRoleLabel, TEAM_ROLE_OPTIONS } from "@/lib/roles";
import type {
  BackendTeamRole,
  CallSummaryRecord,
  DashboardSummaryRecord,
  SlaBreachRecord,
  SlaSummaryRecord,
  StaffCallMetricRecord,
  StaffResponseMetricRecord,
  TeamMember,
} from "@/lib/api-types";

type TeamPerformanceRow = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  status?: string;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  bookedConsults: number;
  bookingRate: number;
  connectRate: number;
  respondedLeads: number;
  averageResponseMinutes: number;
  complianceRate: number;
  breachCount: number;
  score: number;
  risk: "strong" | "watch" | "risk";
};

function memberName(member: TeamMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
}

function formatDate(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function normaliseName(value: string) {
  return value.trim().toLowerCase();
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function calculateScore(row: {
  complianceRate: number;
  bookingRate: number;
  connectRate: number;
  missedCalls: number;
  totalCalls: number;
}) {
  const missedPenalty = row.totalCalls
    ? Math.min(20, Math.round((row.missedCalls / row.totalCalls) * 100))
    : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        row.complianceRate * 0.35 +
          row.bookingRate * 0.3 +
          row.connectRate * 0.25 +
          10 -
          missedPenalty,
      ),
    ),
  );
}

function riskForScore(
  score: number,
  breachCount: number,
): TeamPerformanceRow["risk"] {
  if (score >= 75 && breachCount === 0) return "strong";
  if (score >= 55) return "watch";
  return "risk";
}

function riskBadge(risk: TeamPerformanceRow["risk"]) {
  if (risk === "strong") return <Badge variant="success">Strong</Badge>;
  if (risk === "watch") return <Badge variant="warning">Watch</Badge>;
  return <Badge variant="error">At Risk</Badge>;
}

function mergePerformanceRows({
  members,
  callMetrics,
  responseMetrics,
  breaches,
}: {
  members: TeamMember[];
  callMetrics: StaffCallMetricRecord[];
  responseMetrics: StaffResponseMetricRecord[];
  breaches: SlaBreachRecord[];
}) {
  const rows = new Map<string, TeamPerformanceRow>();

  const ensureRow = (key: string, name: string): TeamPerformanceRow => {
    const existing = rows.get(key);
    if (existing) return existing;

    const row: TeamPerformanceRow = {
      id: key,
      name,
      totalCalls: 0,
      connectedCalls: 0,
      missedCalls: 0,
      bookedConsults: 0,
      bookingRate: 0,
      connectRate: 0,
      respondedLeads: 0,
      averageResponseMinutes: 0,
      complianceRate: 0,
      breachCount: 0,
      score: 0,
      risk: "risk",
    };
    rows.set(key, row);
    return row;
  };

  members
    .filter((member) => !member.isInvitation)
    .forEach((member) => {
      const name = memberName(member);
      const row = ensureRow(member.id, name);
      row.email = member.email;
      row.role = member.role;
      row.status = member.status;
    });

  callMetrics.forEach((metric) => {
    const key = metric.userId || normaliseName(metric.userName);
    const row = ensureRow(key, metric.userName || "Unassigned");
    row.totalCalls = metric.totalCalls;
    row.connectedCalls = metric.connectedCalls;
    row.missedCalls = metric.missedCalls;
    row.bookedConsults = metric.bookedConsults;
    row.bookingRate = Math.round(metric.bookingRate || 0);
    row.connectRate = percent(metric.connectedCalls, metric.totalCalls);
  });

  responseMetrics.forEach((metric) => {
    const key = metric.userId || normaliseName(metric.userName);
    const row = ensureRow(key, metric.userName || "Unassigned");
    row.respondedLeads = metric.respondedLeads;
    row.averageResponseMinutes = Math.round(metric.averageResponseMinutes || 0);
    row.complianceRate = Math.round(metric.complianceRate || 0);
  });

  breaches.forEach((breach) => {
    const key = normaliseName(breach.assignedTo || "Unassigned");
    const row = Array.from(rows.values()).find(
      (candidate) => normaliseName(candidate.name) === key,
    );
    if (row) row.breachCount += 1;
  });

  return Array.from(rows.values())
    .map((row) => {
      const score = calculateScore(row);
      return {
        ...row,
        score,
        risk: riskForScore(score, row.breachCount),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export default function TeamPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [callMetrics, setCallMetrics] = useState<StaffCallMetricRecord[]>([]);
  const [responseMetrics, setResponseMetrics] = useState<
    StaffResponseMetricRecord[]
  >([]);
  const [breaches, setBreaches] = useState<SlaBreachRecord[]>([]);
  const [slaSummary, setSlaSummary] = useState<SlaSummaryRecord | null>(null);
  const [callSummary, setCallSummary] = useState<CallSummaryRecord | null>(null);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryRecord | null>(null);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const [
        teamRows,
        staffCalls,
        staffResponse,
        breachRows,
        sla,
        calls,
        summary,
      ] = await Promise.all([
        api.team.getMembers(token),
        api.calls.staffMetrics(token),
        api.sla.getStaffResponseMetrics(token),
        api.sla.listBreaches(token),
        api.sla.getSummary(token),
        api.calls.summary(token),
        api.reports.dashboardSummary(token),
      ]);

      setMembers(teamRows);
      setCallMetrics(staffCalls);
      setResponseMetrics(staffResponse);
      setBreaches(breachRows);
      setSlaSummary(sla);
      setCallSummary(calls);
      setDashboardSummary(summary);
      setStatusMessage(null);
    } catch (error) {
      console.error("Failed to load team performance", error);
      setMembers([]);
      setCallMetrics([]);
      setResponseMetrics([]);
      setBreaches([]);
      setSlaSummary(null);
      setCallSummary(null);
      setDashboardSummary(null);
      setStatusMessage(
        error instanceof Error
          ? `Team performance data could not fully load: ${error.message}`
          : "Team performance data could not fully load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const performanceRows = useMemo(
    () =>
      mergePerformanceRows({
        members,
        callMetrics,
        responseMetrics,
        breaches,
      }),
    [breaches, callMetrics, members, responseMetrics],
  );

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return performanceRows;
    return performanceRows.filter((row) =>
      [row.name, row.email || "", getRoleLabel(row.role), row.status || "", row.risk].some(
        (value) => value.toLowerCase().includes(search),
      ),
    );
  }, [performanceRows, query]);

  const filteredMembers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return members;
    return members.filter((member) =>
      [memberName(member), member.email, getRoleLabel(member.role), member.status].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }, [members, query]);

  const topPerformer = performanceRows[0];
  const atRiskRows = performanceRows.filter((row) => row.risk === "risk");
  const activeMembers = members.filter(
    (member) => member.status === "active" && !member.isInvitation,
  ).length;
  const avgScore = performanceRows.length
    ? Math.round(
        performanceRows.reduce((sum, row) => sum + row.score, 0) /
          performanceRows.length,
      )
    : 0;

  const handleRoleChange = async (member: TeamMember, role: BackendTeamRole) => {
    if (!token || member.isInvitation) return;

    const previousMembers = members;
    setMembers((current) =>
      current.map((item) => (item.id === member.id ? { ...item, role } : item)),
    );

    try {
      await api.team.updateMemberRole(token, member.id, role);
      setStatusMessage("Team role updated.");
    } catch (error) {
      console.error("Failed to update team role", error);
      setMembers(previousMembers);
      setStatusMessage("Could not update role.");
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!token) return;
    if (!window.confirm(`Remove ${memberName(member)}?`)) return;

    try {
      if (member.isInvitation) {
        await api.team.cancelInvitation(token, member.id);
      } else {
        await api.team.removeMember(token, member.id);
      }
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setStatusMessage(
        member.isInvitation ? "Invitation cancelled." : "Member removed.",
      );
    } catch (error) {
      console.error("Failed to remove team member", error);
      setStatusMessage("Could not remove member.");
    }
  };

  const handleResendInvitation = async (member: TeamMember) => {
    if (!token || !member.isInvitation) return;

    try {
      await api.team.resendInvitation(token, member.id);
      setStatusMessage("Invitation resent.");
    } catch (error) {
      console.error("Failed to resend invitation", error);
      setStatusMessage("Could not resend invitation.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Performance"
        subtitle="Front desk response, call handling, booking conversion and access."
        icon={Users}
        iconColor="text-[#5e8a8d]"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={isLoading || !token}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[#151f21] bg-[#FFFCF9] border border-[rgba(21,31,33,0.08)] hover:bg-[#eaedeb] disabled:opacity-60 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Refresh
            </button>
            <Link href="/app/ops/team/invite" className="btn-primary">
              <Plus className="w-4 h-4" /> Invite
            </Link>
          </div>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Team data notice"
          description={statusMessage}
          variant={statusMessage.includes("Could not") ? "error" : "warning"}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Team"
          value={String(activeMembers)}
          sub={`${members.filter((member) => member.isInvitation).length} pending invites`}
          icon={Users}
          color="teal"
        />
        <StatCard
          label="Team Score"
          value={`${avgScore}%`}
          sub={topPerformer ? `Top: ${topPerformer.name}` : "No performance data"}
          icon={ShieldCheck}
          color={avgScore >= 75 ? "green" : "amber"}
        />
        <StatCard
          label="SLA Compliance"
          value={`${Math.round(slaSummary?.complianceRate || 0)}%`}
          sub={`${slaSummary?.breachedLeadCount || 0} breached leads`}
          icon={Clock}
          color={(slaSummary?.breachedLeadCount || 0) > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Call Booking"
          value={`${Math.round(callSummary?.callToBookingRate || 0)}%`}
          sub={`${callSummary?.bookedConsults || 0} consults booked`}
          icon={Phone}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-6">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[#151f21]">
                Accountability Scoreboard
              </h2>
              <p className="text-sm text-[#5e8a8d] mt-1">
                Score blends SLA compliance, call connection, booking rate and
                missed-call pressure.
              </p>
            </div>
            <Badge variant={atRiskRows.length > 0 ? "warning" : "success"}>
              {isLoading ? "Loading" : `${atRiskRows.length} at risk`}
            </Badge>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 rounded-xl bg-[rgba(94,138,141,0.08)] animate-pulse"
                />
              ))
            ) : filteredRows.length ? (
              filteredRows.slice(0, 6).map((row) => (
              <div key={row.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={row.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#151f21] truncate">
                        {row.name}
                      </p>
                      <p className="text-xs text-[#7A746A]">
                        {row.respondedLeads} responses · {row.totalCalls} calls
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {riskBadge(row.risk)}
                    <span className="text-sm font-bold text-[#151f21]">
                      {row.score}%
                    </span>
                  </div>
                </div>
                <ProgressBar
                  value={row.score}
                  max={100}
                  color={row.risk === "risk" ? "#9a5524" : "#60b4af"}
                />
              </div>
              ))
            ) : (
              <EmptyState
                icon={Users}
                title="No performance rows"
                description="No live team performance records were found."
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[#151f21] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#5e8a8d]" />
            Coaching Focus
          </h2>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-2xl bg-[rgba(94,138,141,0.08)] animate-pulse"
                />
              ))
            ) : atRiskRows.length ? (
              atRiskRows.slice(0, 4).map((row) => (
              <div
                key={row.id}
                className="p-4 rounded-2xl bg-[#F7F5F2] border border-[#EDE8E2]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#151f21]">{row.name}</p>
                  {riskBadge(row.risk)}
                </div>
                <p className="text-xs text-[#7A746A] mt-2">
                  {row.breachCount > 0
                    ? `${row.breachCount} SLA breaches need review.`
                    : row.missedCalls > 0
                      ? `${row.missedCalls} missed calls need recovery.`
                      : "Review response quality and conversion consistency."}
                </p>
              </div>
              ))
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="No coaching risks"
                description="The current team metrics do not show any urgent performance risks."
              />
            )}
          </div>
        </Card>
      </div>

      <SearchInput
        placeholder="Search team members or performance rows..."
        value={query}
        onChange={setQuery}
      />

      <DataTable
        headers={[
          { label: "Team Member" },
          { label: "Score" },
          { label: "Response" },
          { label: "Calls" },
          { label: "Bookings" },
          { label: "Risk" },
        ]}
      >
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <td colSpan={6} className="px-6 py-3">
                <div className="h-12 rounded-xl bg-[rgba(94,138,141,0.08)] animate-pulse" />
              </td>
            </TableRow>
          ))
        ) : filteredRows.length ? (
          filteredRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="flex items-center gap-3 min-w-[220px]">
                <Avatar name={row.name} size="sm" />
                <div>
                  <p className="font-semibold text-[#151f21]">{row.name}</p>
                  <p className="text-xs text-[#7A746A]">
                    {row.email || row.role || "Performance record"}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-lg font-bold text-[#151f21]">
                {row.score}%
              </span>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <p className="font-semibold text-[#151f21]">
                  {row.complianceRate}% compliant
                </p>
                <p className="text-xs text-[#7A746A]">
                  {row.averageResponseMinutes}m avg · {row.respondedLeads} leads
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <p className="font-semibold text-[#151f21]">
                  {row.totalCalls} total
                </p>
                <p className="text-xs text-[#7A746A]">
                  {row.connectRate}% connected · {row.missedCalls} missed
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <p className="font-semibold text-[#151f21]">
                  {row.bookedConsults} booked
                </p>
                <p className="text-xs text-[#7A746A]">
                  {row.bookingRate}% call booking rate
                </p>
              </div>
            </TableCell>
            <TableCell>{riskBadge(row.risk)}</TableCell>
          </TableRow>
          ))
        ) : (
          <TableRow>
            <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#7A746A]">
              No live team performance rows found.
            </td>
          </TableRow>
        )}
      </DataTable>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-semibold text-[#151f21] flex items-center gap-2">
            <UserRound className="w-5 h-5 text-[#5e8a8d]" />
            Access Management
          </h2>
          <Badge variant="neutral">
            {dashboardSummary?.cards.leads || 0} leads in current dashboard
          </Badge>
        </div>

        <DataTable
          headers={[
            { label: "Member" },
            { label: "Role" },
            { label: "Status" },
            { label: "Last Active" },
            { label: "", className: "text-right" },
          ]}
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <td colSpan={5} className="px-6 py-3">
                  <div className="h-12 rounded-xl bg-[rgba(94,138,141,0.08)] animate-pulse" />
                </td>
              </TableRow>
            ))
          ) : filteredMembers.length ? (
            filteredMembers.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={memberName(member)} size="sm" />
                  <div>
                    <p className="font-medium">{memberName(member)}</p>
                    <p className="text-sm text-[#7A746A]">{member.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {member.isInvitation ? (
                  <Badge variant="neutral">{getRoleLabel(member.role)}</Badge>
                ) : (
                  <select
                    value={member.role}
                    onChange={(event) =>
                      handleRoleChange(member, event.target.value as BackendTeamRole)
                    }
                    className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-xs font-semibold text-[#151f21]"
                  >
                    {TEAM_ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={member.status} />
              </TableCell>
              <TableCell className="text-[#7A746A] text-sm">
                {member.isInvitation
                  ? `Expires ${formatDate(member.expiresAt)}`
                  : formatDate(member.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {member.isInvitation && (
                    <button
                      onClick={() => handleResendInvitation(member)}
                      className="text-xs font-semibold text-[#5e8a8d] hover:underline"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(member)}
                    className="text-xs font-semibold text-[#9a5524] hover:underline"
                  >
                    {member.isInvitation ? "Cancel" : "Remove"}
                  </button>
                </div>
              </TableCell>
            </TableRow>
            ))
          ) : (
            <TableRow>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#7A746A]">
                No live team members or pending invitations found.
              </td>
            </TableRow>
          )}
        </DataTable>
      </Card>
    </div>
  );
}
