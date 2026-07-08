"use client";

import RolesManagementPage from "./roles-management-page";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, LockKeyhole, Shield } from "lucide-react";
import {
  AlertBanner,
  Badge,
  Card,
  DataTable,
  PageHeader,
  SearchInput,
  TableCell,
  TableRow,
  TableRowSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { PermissionRecord, RoleRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export default RolesManagementPage;

function formatPermissionLabel(value: string) {
  return value
    .split(":")
    .map((part) =>
      part
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .join(" / ");
}

export function LegacyRolesSettingsPage() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let cancelled = false;

    async function loadRoles() {
      setIsLoading(true);
      try {
        const [roleRows, permissionRows] = await Promise.all([
          api.roles.list(session!.token),
          api.roles.permissions(session!.token),
        ]);
        if (!cancelled) {
          setRoles(roleRows);
          setPermissions(permissionRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load roles", error);
        if (!cancelled) {
          setRoles([]);
          setPermissions([]);
          setStatusMessage(
            error instanceof Error
              ? `Live roles could not load: ${error.message}`
              : "Live roles could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRoles();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const permissionByKey = useMemo(() => {
    return new Map(permissions.map((permission) => [permission.keyName, permission]));
  }, [permissions]);

  const filteredRoles = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return roles;
    return roles.filter((role) =>
      [
        role.displayName,
        role.name,
        role.description || "",
        role.isSystem ? "system" : "custom",
        role.permissions.join(" "),
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [query, roles]);

  const assignedPermissionCount = new Set(
    roles.flatMap((role) => role.permissions),
  ).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        subtitle="Review system roles and their assigned permissions."
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Roles data notice"
          description={statusMessage}
          variant="warning"
        />
      )}

      <AlertBanner
        icon={Info}
        title="System roles are protected"
        description="Custom workspace roles can be created and edited from the live role management view."
        variant="info"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Roles
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : roles.length}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Live role records</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Permissions
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : permissions.length}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Assignable permission keys</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Assigned
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : assignedPermissionCount}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Used by visible roles</p>
        </Card>
      </div>

      <SearchInput
        placeholder="Search roles, descriptions or permissions..."
        value={query}
        onChange={setQuery}
      />

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-container bg-[rgba(110,106,232,0.08)]">
            <Shield className="w-5 h-5 text-[#6E6AE8]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#111111]">System Roles</h2>
            <p className="text-sm text-[#6B7280]">
              Loaded from the live role and permission registry.
            </p>
          </div>
        </div>

        <DataTable
          headers={[
            { label: "Role" },
            { label: "Description" },
            { label: "Type" },
            { label: "Permissions" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <TableRowSkeleton key={`role-loading-${index}`} columns={4} />
            ))}
          {!isLoading && filteredRoles.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {query
                  ? "No roles match that search."
                  : "No live roles are available for this workspace."}
              </td>
            </tr>
          )}
          {!isLoading && filteredRoles.map((role) => (
            <TableRow key={role.id}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium text-[#111111]">
                  <LockKeyhole className="w-4 h-4 text-[#6E6AE8]" />
                  {role.displayName}
                </div>
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {role.description ?? "-"}
              </TableCell>
              <TableCell>
                <Badge variant={role.isSystem ? "info" : "neutral"} size="xs">
                  {role.isSystem ? "System" : "Custom"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                <div className="flex max-w-2xl flex-wrap gap-2">
                  {role.permissions.map((permission) => (
                    <span
                      key={permission}
                      title={permissionByKey.get(permission)?.description || permission}
                      className="rounded-full border border-[#d8ddda] bg-white px-2.5 py-1 text-xs font-semibold text-[#151f21]"
                    >
                      {formatPermissionLabel(permission)}
                    </span>
                  ))}
                  {role.permissions.length === 0 && (
                    <Badge variant="warning" size="xs">
                      No permissions
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
