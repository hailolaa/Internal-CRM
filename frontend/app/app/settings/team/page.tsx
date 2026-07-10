"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  StatusBadge,
  Avatar,
  MoreButton,
  SearchInput,
  TableRowSkeleton,
} from "@/components/ui";
import { ROLE_COLORS } from "@/lib/data";
import { api } from "@/lib/api-client";
import type { TeamMember } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { getRoleLabel } from "@/lib/roles";

type TeamRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

function toTeamRow(member: TeamMember): TeamRow {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
  return {
    id: member.id,
    name: name || member.email,
    email: member.email,
    role: member.role,
    status: member.status,
  };
}

export default function TeamSettingsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    api.team
      .getMembers(session.token)
      .then((records) => {
        if (!isMounted) return;
        const rows = records.map(toTeamRow);
        setLoadError("");
        setMembers(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load team members from the backend.",
        );
        setMembers([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query),
    );
  }, [members, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        subtitle="Invite and manage internal users, roles, and access."
        right={
          <button
            onClick={() => router.push("/app/ops/team/invite")}
            className="bg-teal-500 hover:bg-teal-600 text-black font-medium px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Invite
          </button>
        }
      />

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search team"
        className="max-w-md"
      />

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend team members could not be loaded. {loadError}
        </div>
      )}

      <DataTable
        headers={[
          { label: "Member" },
          { label: "Role" },
          { label: "Status" },
          { label: "" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 5 }, (_, index) => (
            <TableRowSkeleton key={index} columns={4} />
          ))}
        {!isLoading && filteredMembers.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar name={m.name} size="sm" />
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span
                className={`text-xs px-2 py-1 rounded ${ROLE_COLORS[getRoleLabel(m.role)] || "bg-gray-500/10 text-gray-400"}`}
              >
                {getRoleLabel(m.role)}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge status={m.status} />
            </TableCell>
            <TableCell className="text-right">
              <MoreButton />
            </TableCell>
          </TableRow>
        ))}
        {!isLoading && filteredMembers.length === 0 && (
          <TableRow>
            <td className="px-6 py-8 text-sm text-[#6B7280]" colSpan={4}>
              No team members loaded yet.
            </td>
          </TableRow>
        )}
      </DataTable>

      <div className="text-xs text-gray-500">
        Detailed access control is managed from Roles & Permissions.
      </div>
    </div>
  );
}
