"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Edit3,
  LockKeyhole,
  Plus,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";
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

type RoleFormState = {
  id: string | null;
  displayName: string;
  description: string;
  permissions: string[];
};

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

function permissionGroup(value: string) {
  return value.split(":")[0] || "general";
}

export default function RolesManagementPage() {
  const { session, hasPermission } = useAuth();
  const formBaseId = useId();
  const canWriteRoles = hasPermission("settings:write");
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mutatingRoleId, setMutatingRoleId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;
    Promise.all([api.roles.list(session.token), api.roles.permissions(session.token)])
      .then(([roleRows, permissionRows]) => {
        if (cancelled) return;
        setRoles(roleRows);
        setPermissions(permissionRows);
        setNotice(null);
      })
      .catch((error) => {
        console.error("Failed to load roles", error);
        if (!cancelled) {
          setRoles([]);
          setPermissions([]);
          setNotice({
            type: "warning",
            title: "Roles data notice",
            description:
              error instanceof Error
                ? `Live roles could not load: ${error.message}`
                : "Live roles could not load.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const permissionByKey = useMemo(() => {
    return new Map(permissions.map((permission) => [permission.keyName, permission]));
  }, [permissions]);

  const permissionsByGroup = useMemo(() => {
    const groups = new Map<string, PermissionRecord[]>();
    for (const permission of permissions) {
      const group = permissionGroup(permission.keyName);
      groups.set(group, [...(groups.get(group) || []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
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

  const customRoleCount = roles.filter((role) => !role.isSystem).length;

  const startCreate = () => {
    setForm({
      id: null,
      displayName: "",
      description: "",
      permissions: permissions
        .filter((permission) => permission.keyName === "settings:read")
        .map((permission) => permission.keyName),
    });
    setNotice(null);
  };

  const startEdit = (role: RoleRecord) => {
    if (role.isSystem) {
      setNotice({
        type: "warning",
        title: "System roles are protected",
        description: "Create a custom internal role if this team needs different access.",
      });
      return;
    }

    setForm({
      id: role.id,
      displayName: role.displayName,
      description: role.description || "",
      permissions: role.permissions,
    });
    setNotice(null);
  };

  const togglePermission = (permissionKey: string) => {
    setForm((current) => {
      if (!current) return current;
      const hasKey = current.permissions.includes(permissionKey);
      return {
        ...current,
        permissions: hasKey
          ? current.permissions.filter((key) => key !== permissionKey)
          : [...current.permissions, permissionKey].sort(),
      };
    });
  };

  const saveRole = async () => {
    if (!session?.token || !form) return;

    if (!form.displayName.trim()) {
      setNotice({ type: "error", title: "Role name is required" });
      return;
    }

    if (form.permissions.length === 0) {
      setNotice({ type: "error", title: "Select at least one permission" });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const saved = form.id
        ? await api.roles.update(session.token, form.id, {
            displayName: form.displayName.trim(),
            description: form.description.trim() || null,
            permissions: form.permissions,
          })
        : await api.roles.create(session.token, {
            displayName: form.displayName.trim(),
            description: form.description.trim() || null,
            permissions: form.permissions,
          });

      setRoles((current) =>
        form.id
          ? current.map((role) => (role.id === saved.id ? saved : role))
          : [saved, ...current],
      );
      setForm(null);
      setNotice({
        type: "success",
        title: form.id ? "Role updated" : "Role created",
        description: `${saved.displayName} permissions are live.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        title: "Role save failed",
        description: error instanceof Error ? error.message : "Unable to save role.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const archiveRole = async (role: RoleRecord) => {
    if (!session?.token || role.isSystem) return;
    const confirmed = window.confirm(
      `Archive ${role.displayName}? This is blocked if active team members still use the role.`,
    );
    if (!confirmed) return;

    setMutatingRoleId(role.id);
    setNotice(null);

    try {
      await api.roles.archive(session.token, role.id);
      setRoles((current) => current.filter((item) => item.id !== role.id));
      if (form?.id === role.id) setForm(null);
      setNotice({
        type: "success",
        title: "Role archived",
        description: `${role.displayName} is no longer available.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        title: "Role archive failed",
        description: error instanceof Error ? error.message : "Unable to archive role.",
      });
    } finally {
      setMutatingRoleId(null);
    }
  };

  const alertIcon = notice?.type === "success" ? CheckCircle : AlertTriangle;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage internal role definitions and access permissions for the Mission Control team."
        right={
          <button
            type="button"
            onClick={startCreate}
            disabled={!canWriteRoles || isLoading}
            className="btn-primary w-fit disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Internal Role
          </button>
        }
      />

      {notice && (
        <AlertBanner
          icon={alertIcon}
          title={notice.title}
          description={notice.description}
          variant={notice.type === "success" ? "success" : notice.type}
        />
      )}

      {!canWriteRoles && (
        <AlertBanner
          icon={LockKeyhole}
          title="Role editing requires settings write access"
          description="You can review role permissions, but saves and archive actions are disabled for your account."
          variant="info"
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Internal Roles
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : roles.length}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Team access profiles</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Permission Keys
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : permissions.length}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Internal access controls</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
            Custom Roles
          </p>
          <p className="mt-2 text-3xl font-bold text-[#151f21]">
            {isLoading ? "..." : customRoleCount}
          </p>
          <p className="mt-1 text-sm text-[#7A746A]">Editable custom roles</p>
        </Card>
      </div>

      <AlertBanner
        icon={LockKeyhole}
        title="Default roles are protected"
        description="Super Admin, Admin, Sales, Delivery, Finance, and Internal Viewer are the fixed MVP roles. Create a custom internal role when you need something editable or archivable."
        variant="info"
      />

      {form && (
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#111111]">
                {form.id ? "Edit Internal Role" : "Create Internal Role"}
              </h2>
              <p className="text-sm text-[#6B7280]">
                Select the exact permissions this role should grant.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-2 text-[#6B7280] hover:bg-[rgba(0,0,0,0.04)]"
              aria-label="Close role form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor={`${formBaseId}-role-name`}
                className="mb-1.5 block text-sm font-medium text-[#151f21]"
              >
                Role name
              </label>
              <input
                id={`${formBaseId}-role-name`}
                name="roleName"
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, displayName: event.target.value } : current,
                  )
                }
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#111111] focus:border-[#6E6AE8] focus:outline-none"
                placeholder="Growth Manager"
              />
            </div>
            <div>
              <label
                htmlFor={`${formBaseId}-role-description`}
                className="mb-1.5 block text-sm font-medium text-[#151f21]"
              >
                Description
              </label>
              <input
                id={`${formBaseId}-role-description`}
                name="roleDescription"
                value={form.description}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#111111] focus:border-[#6E6AE8] focus:outline-none"
                placeholder="Access for marketing and reports work"
              />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {permissionsByGroup.map(([group, groupPermissions]) => (
              <div key={group} className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4">
                <p className="mb-3 text-sm font-semibold capitalize text-[#151f21]">
                  {group.replace(/-/g, " ")}
                </p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {groupPermissions.map((permission) => {
                    const permissionInputId = `${formBaseId}-permission-${permission.keyName.replace(/[^a-z0-9_-]/gi, "-")}`;

                    return (
                      <label
                        key={permission.id}
                        htmlFor={permissionInputId}
                        className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm text-[#151f21]"
                      >
                        <input
                          id={permissionInputId}
                          name="rolePermissions"
                          type="checkbox"
                          checked={form.permissions.includes(permission.keyName)}
                          onChange={() => togglePermission(permission.keyName)}
                          className="mt-1 h-4 w-4 accent-[#6E6AE8]"
                        />
                        <span>
                          <span className="block font-medium">
                            {formatPermissionLabel(permission.keyName)}
                          </span>
                          {permission.description && (
                            <span className="mt-0.5 block text-xs text-[#6B7280]">
                              {permission.description}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#6B7280]">
              {form.permissions.length} permission{form.permissions.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              onClick={() => void saveRole()}
              disabled={!canWriteRoles || isSaving}
              className="btn-primary w-fit disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Role"}
            </button>
          </div>
        </Card>
      )}

      <SearchInput
        id="roles-search"
        name="rolesSearch"
        ariaLabel="Search roles, descriptions or permissions"
        placeholder="Search roles, descriptions or permissions..."
        value={query}
        onChange={setQuery}
      />

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="icon-container bg-[rgba(110,106,232,0.08)]">
            <Shield className="h-5 w-5 text-[#6E6AE8]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#111111]">Access Registry</h2>
            <p className="text-sm text-[#6B7280]">
              Default internal roles are protected. Custom internal roles can be edited or archived here.
            </p>
          </div>
        </div>

        <DataTable
          headers={[
            { label: "Role" },
            { label: "Description" },
            { label: "Type" },
            { label: "Permissions" },
            { label: "" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <TableRowSkeleton key={`role-loading-${index}`} columns={5} />
            ))}
          {!isLoading && filteredRoles.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {query
                  ? "No roles match that search."
                  : "No live roles are available for Mission Control."}
              </td>
            </tr>
          )}
          {!isLoading && filteredRoles.map((role) => (
            <TableRow key={role.id}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium text-[#111111]">
                  <LockKeyhole className={`h-4 w-4 ${role.isSystem ? "text-[#6E6AE8]" : "text-[#60b4af]"}`} />
                  {role.displayName}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {role.isSystem ? "Protected default role" : "Custom internal role"}
                </p>
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {role.description ?? "-"}
              </TableCell>
              <TableCell>
                <Badge variant={role.isSystem ? "info" : "neutral"} size="xs">
                  {role.isSystem ? "Protected" : "Custom"}
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
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(role)}
                    disabled={!canWriteRoles || role.isSystem}
                    title={
                      role.isSystem
                        ? "Protected default roles cannot be edited. Create a custom internal role to edit permissions."
                        : "Edit custom role"
                    }
                    className="rounded-lg p-2 text-[#6B7280] hover:bg-[rgba(0,0,0,0.04)] disabled:opacity-40"
                    aria-label={`Edit ${role.displayName}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void archiveRole(role)}
                    disabled={!canWriteRoles || role.isSystem || mutatingRoleId === role.id}
                    title={
                      role.isSystem
                        ? "Protected default roles cannot be archived. Create a custom internal role to archive it later."
                        : "Archive custom role"
                    }
                    className="rounded-lg p-2 text-[#6B7280] hover:bg-[rgba(0,0,0,0.04)] disabled:opacity-40"
                    aria-label={`Archive ${role.displayName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
