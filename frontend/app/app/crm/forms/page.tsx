"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  Eye,
  Copy,
  Edit,
  BarChart3,
  Archive,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { FormDefinitionRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, Card, CardSkeleton, SkeletonLine } from "@/components/ui";
import { publicEnv } from "@/lib/env";

type FormRow = {
  id: string;
  name: string;
  typeRaw: string;
  type: string;
  submissions: number;
  conversionRate: string;
  status: "active" | "draft" | "archived";
  lastSubmission: string;
  views: number;
};

const typeColors: Record<string, string> = {
  Lead: "bg-blue-500/10 text-blue-600",
  Booking: "bg-green-500/10 text-green-600",
  Intake: "bg-violet-500/10 text-violet-600",
  Survey: "bg-amber-500/10 text-amber-600",
  Consent: "bg-rose-500/10 text-rose-600",
  "Lead Capture": "bg-blue-500/10 text-blue-600",
};

function formatLastSubmission(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatFormType(type: string) {
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toFormRow(record: FormDefinitionRecord): FormRow {
  const conversionRate =
    record.views > 0
      ? `${Math.round((record.submissions / record.views) * 100)}%`
      : "N/A";

  return {
    id: record.id,
    name: record.name,
    typeRaw: record.type,
    type: formatFormType(record.type),
    submissions: record.submissions,
    conversionRate,
    status: record.status,
    lastSubmission: formatLastSubmission(record.lastSubmission),
    views: record.views,
  };
}

export default function FormsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [forms, setForms] = useState<FormRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [updatingFormId, setUpdatingFormId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.forms
      .list(token)
      .then((records) => {
        if (!isMounted) return;
        const rows = records.map(toFormRow);
        setLoadError("");
        setForms(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load forms from the backend.",
        );
        setForms([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filtered = forms.filter((form) => {
    const matchesSearch = form.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === "All" || form.typeRaw === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalSubmissions = forms.reduce((acc, f) => acc + f.submissions, 0);
  const activeFormsCount = forms.filter((f) => f.status === "active").length;
  const totalViews = forms.reduce((acc, f) => acc + f.views, 0);
  const avgConversion =
    totalViews > 0 ? `${Math.round((totalSubmissions / totalViews) * 100)}%` : "-";
  const filterTabs = [
    { value: "All", label: "All" },
    ...Array.from(new Set(forms.map((form) => form.typeRaw))).map((value) => ({
      value,
      label: formatFormType(value),
    })),
  ];

  const updateFormStatus = async (
    form: FormRow,
    status: FormRow["status"],
  ) => {
    if (!token) return;

    setUpdatingFormId(form.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.forms.update(token, form.id, { status });
      setForms((current) =>
        current.map((item) => (item.id === form.id ? { ...item, status } : item)),
      );
      setActionMessage(`${form.name} marked as ${status}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update form.",
      );
    } finally {
      setUpdatingFormId(null);
    }
  };

  const archiveForm = async (form: FormRow) => {
    if (!token) return;

    setUpdatingFormId(form.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.forms.remove(token, form.id);
      setForms((current) => current.filter((item) => item.id !== form.id));
      setActionMessage(`${form.name} archived.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to archive form.",
      );
    } finally {
      setUpdatingFormId(null);
    }
  };

  const publicFormUrl = (form: FormRow) =>
    `${publicEnv.appUrl}/forms?id=${encodeURIComponent(form.id)}`;

  const copyPublicLink = async (form: FormRow) => {
    const endpoint = publicFormUrl(form);
    setActionMessage("");
    setActionError("");

    try {
      await navigator.clipboard.writeText(endpoint);
      setActionMessage(`Public form link copied for ${form.name}.`);
    } catch {
      setActionError(`Copy failed. Public form link: ${endpoint}`);
    }
  };

  const openPublicForm = (form: FormRow) => {
    window.open(publicFormUrl(form), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Forms</h1>
          <p className="text-[#6B7280] mt-1">
            Create and manage intake forms, surveys, and lead capture.
          </p>
        </div>
        <button
          onClick={() => router.push("/app/crm/forms/builder")}
          className="btn-primary w-fit"
        >
          <Plus className="w-4 h-4" /> Create Form
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-14 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-[#111111]">{forms.length}</p>
          )}
          <p className="text-sm text-[#6B7280]">Total Forms</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-14 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-emerald-600">
              {activeFormsCount}
            </p>
          )}
          <p className="text-sm text-[#6B7280]">Active</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-16 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-[#6E6AE8]">
              {totalSubmissions}
            </p>
          )}
          <p className="text-sm text-[#6B7280]">Total Submissions</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-16 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-violet-600">
              {avgConversion}
            </p>
          )}
          <p className="text-sm text-[#6B7280]">Avg Conversion</p>
        </div>
      </div>

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend forms could not be loaded"
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
          title="Form action failed"
          description={actionError}
          variant="error"
        />
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            id="forms-search"
            name="forms-search"
            type="text"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className="px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors font-medium"
              style={{
                backgroundColor:
                  activeFilter === tab.value
                    ? "rgba(110, 106, 232, 0.08)"
                    : "white",
                color: activeFilter === tab.value ? "#6E6AE8" : "#6B7280",
                border:
                  activeFilter === tab.value
                    ? "1px solid rgba(110, 106, 232, 0.2)"
                    : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading &&
          Array.from({ length: 3 }, (_, index) => (
            <CardSkeleton key={index} lines={5} />
          ))}
        {!isLoading && filtered.map((form) => (
          <div
            key={form.id}
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 hover:border-[#B7A6FF] transition-all group"
            style={{ boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(110, 106, 232, 0.08)" }}
              >
                <FileText className="w-5 h-5 text-[#6E6AE8]" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openPublicForm(form)}
                  aria-label={`Open public form for ${form.name}`}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3EF]"
                >
                  <Eye className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button
                  onClick={() => void copyPublicLink(form)}
                  aria-label={`Copy link for ${form.name}`}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3EF]"
                >
                  <Copy className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button
                  onClick={() => router.push(`/app/crm/forms/preview?id=${form.id}`)}
                  aria-label={`Preview ${form.name} in app`}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3EF]"
                >
                  <ExternalLink className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button
                  onClick={() =>
                    router.push(`/app/crm/forms/builder?id=${form.id}`)
                  }
                  aria-label={`Edit ${form.name}`}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3EF]"
                >
                  <Edit className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button
                  onClick={() =>
                    setSelectedFormId((current) =>
                      current === form.id ? null : form.id,
                    )
                  }
                  aria-label={`More options for ${form.name}`}
                  className="p-1.5 rounded-lg hover:bg-[#F6F3EF]"
                >
                  <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
            </div>
            {selectedFormId === form.id && (
              <div className="mb-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void updateFormStatus(form, "active")}
                    disabled={
                      updatingFormId === form.id || form.status === "active"
                    }
                    className="rounded-lg px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => void updateFormStatus(form, "draft")}
                    disabled={
                      updatingFormId === form.id || form.status === "draft"
                    }
                    className="rounded-lg px-3 py-2 text-xs font-medium text-[#6B7280] hover:bg-white disabled:opacity-50"
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => router.push("/app/crm/forms/submissions")}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.08)]"
                  >
                    Submissions
                  </button>
                  <button
                    onClick={() => void archiveForm(form)}
                    disabled={updatingFormId === form.id}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Archive className="h-3 w-3" /> Archive
                    </span>
                  </button>
                </div>
              </div>
            )}
            <h3 className="font-semibold mb-1 text-[#111111]">{form.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${typeColors[form.type] || "bg-[rgba(0,0,0,0.04)] text-[#6B7280]"}`}
              >
                {form.type}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${form.status === "active" ? "bg-green-500/10 text-green-600" : "bg-[#F6F3EF] text-[#6B7280]"}`}
              >
                {form.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div>
                <p className="text-[#6B7280] text-xs">Views</p>
                <p className="font-semibold text-[#111111]">
                  {form.views.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[#6B7280] text-xs">Submissions</p>
                <p className="font-semibold text-[#111111]">
                  {form.submissions}
                </p>
              </div>
              <div>
                <p className="text-[#6B7280] text-xs">Conversion</p>
                <p className="font-semibold text-[#6E6AE8]">
                  {form.conversionRate}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[rgba(0,0,0,0.06)]">
              <p className="text-xs text-[#6B7280]">
                Last: {form.lastSubmission}
              </p>
              <button
                onClick={() => router.push("/app/crm/forms/submissions")}
                aria-label={`View submissions for ${form.name}`}
                className="text-xs text-[#6E6AE8] hover:text-[#5B57D1] flex items-center gap-1 font-medium"
              >
                <BarChart3 className="w-3 h-3" /> Submissions
              </button>
            </div>
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <p className="text-sm text-[#6B7280]">No forms loaded yet.</p>
          </Card>
        )}

        {!isLoading && (
          <div
          onClick={() => router.push("/app/crm/forms/builder")}
          className="border-2 border-dashed border-[rgba(0,0,0,0.06)] rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:border-[#B7A6FF] cursor-pointer transition-colors min-h-[240px]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F6F3EF] flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-[#6B7280]" />
          </div>
          <p className="font-medium text-[#6B7280]">Create New Form</p>
          <p className="text-xs text-[#6B7280] mt-1">
            Build custom forms for your clinic
          </p>
          </div>
        )}
      </div>
    </div>
  );
}
