"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Mail,
  MoreHorizontal,
  GitBranch,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type { FormSubmissionRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { downloadCsv } from "@/lib/client-download";
import { SkeletonLine } from "@/components/ui";

const statusConfig: Record<
  string,
  { color: string; icon: typeof CheckCircle }
> = {
  new: { color: "bg-blue-500/10 text-blue-600", icon: AlertCircle },
  contacted: { color: "bg-amber-500/10 text-amber-600", icon: Clock },
  booked: { color: "bg-green-500/10 text-green-600", icon: Calendar },
  completed: {
    color: "bg-[rgba(0,0,0,0.06)] text-[#6B7280]",
    icon: CheckCircle,
  },
};

export default function FormSubmissionsPage() {
  const { session } = useAuth();
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submissions, setSubmissions] = useState<FormSubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedSubmission, setSelectedSubmission] =
    useState<FormSubmissionRecord | null>(null);
  const [mutatingIds, setMutatingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    api.forms
      .listSubmissions(session.token)
      .then((records) => {
        if (!isMounted) return;
        setLoadError("");
        setSubmissions(records);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load form submissions from the backend.",
        );
        setSubmissions([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return submissions.filter(
      (submission) =>
        (!query ||
          submission.name.toLowerCase().includes(query) ||
          submission.email.toLowerCase().includes(query) ||
          submission.phone.toLowerCase().includes(query) ||
          submission.formName.toLowerCase().includes(query) ||
          submission.treatment.toLowerCase().includes(query)) &&
        (!formFilter || submission.formName === formFilter) &&
        (!statusFilter || submission.status === statusFilter),
    );
  }, [formFilter, searchQuery, statusFilter, submissions]);

  const formOptions = useMemo(
    () => Array.from(new Set(submissions.map((submission) => submission.formName))).sort(),
    [submissions],
  );

  const toggleSelection = (id: string) => {
    setSelectedSubmissions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedSubmissions.length === filteredSubmissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(filteredSubmissions.map((s) => s.id));
    }
  };

  const exportSubmissions = (rows = filteredSubmissions) => {
    if (rows.length === 0) {
      setStatusMessage("No submissions are available to export.");
      return;
    }

    downloadCsv(
      "form-submissions.csv",
      rows.map((submission) => ({
        Name: submission.name,
        Email: submission.email,
        Phone: submission.phone,
        Form: submission.formName,
        Treatment: submission.treatment,
        Source: submission.source,
        Status: submission.status,
        Submitted: submission.submittedAt,
      })),
    );
    setStatusMessage(`${rows.length} submission${rows.length === 1 ? "" : "s"} exported.`);
  };

  const selectedRows = useMemo(
    () => submissions.filter((submission) => selectedSubmissions.includes(submission.id)),
    [selectedSubmissions, submissions],
  );

  const emailSubmissions = (rows: FormSubmissionRecord[]) => {
    const recipients = rows.map((submission) => submission.email).filter(Boolean);
    if (recipients.length === 0) {
      setStatusMessage("Selected submissions do not include email addresses.");
      return;
    }

    window.location.href = `mailto:${recipients.join(",")}`;
  };

  const refreshSubmissions = async () => {
    if (!session?.token) return;
    const records = await api.forms.listSubmissions(session.token);
    setLoadError("");
    setSubmissions(records);
  };

  const withMutation = async (ids: string[], action: () => Promise<void>) => {
    setMutatingIds((current) => Array.from(new Set([...current, ...ids])));
    setStatusMessage("");
    try {
      await action();
      await refreshSubmissions();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Submission action failed.",
      );
    } finally {
      setMutatingIds((current) => current.filter((id) => !ids.includes(id)));
    }
  };

  const addSubmissionsToPipeline = async (rows: FormSubmissionRecord[]) => {
    if (!session?.token) return;
    const eligibleRows = rows.filter((submission) => !submission.pipelineDealId);
    if (eligibleRows.length === 0) {
      setStatusMessage("Selected submissions are already linked to pipeline deals.");
      return;
    }

    await withMutation(
      eligibleRows.map((submission) => submission.id),
      async () => {
        await Promise.all(
          eligibleRows.map((submission) =>
            api.forms.addSubmissionToPipeline(session.token, submission.id),
          ),
        );
        setSelectedSubmissions([]);
        setStatusMessage(
          `${eligibleRows.length} submission${eligibleRows.length === 1 ? "" : "s"} added to pipeline.`,
        );
      },
    );
  };

  const archiveSubmissions = async (rows: FormSubmissionRecord[]) => {
    if (!session?.token || rows.length === 0) return;
    const confirmed = window.confirm(
      `Archive ${rows.length} form submission${rows.length === 1 ? "" : "s"}? This hides them from the list but keeps an audit trail.`,
    );
    if (!confirmed) return;

    await withMutation(
      rows.map((submission) => submission.id),
      async () => {
        await Promise.all(
          rows.map((submission) =>
            api.forms.archiveSubmission(session.token, submission.id),
          ),
        );
        setSelectedSubmissions([]);
        if (selectedSubmission && rows.some((row) => row.id === selectedSubmission.id)) {
          setSelectedSubmission(null);
        }
        setStatusMessage(
          `${rows.length} submission${rows.length === 1 ? "" : "s"} archived.`,
        );
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/forms"
          className="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">
            Form Submissions
          </h1>
          <p className="text-[#6B7280] text-sm">
            View and manage all form responses
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportSubmissions()}
          className="px-4 py-2 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[24px] flex items-center gap-2 hover:bg-[#F6F3EF] text-sm text-[#111111]"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend form submissions could not be loaded. {loadError}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-[rgba(110,106,232,0.16)] bg-[rgba(110,106,232,0.06)] px-4 py-3 text-sm text-[#5A56D4]">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4">
          <p className="text-2xl font-bold text-[#111111]">
            {submissions.length}
          </p>
          <p className="text-sm text-[#6B7280]">Total Submissions</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4">
          <p className="text-2xl font-bold text-blue-600">
            {submissions.filter((s) => s.status === "new").length}
          </p>
          <p className="text-sm text-[#6B7280]">New</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4">
          <p className="text-2xl font-bold text-amber-600">
            {submissions.filter((s) => s.status === "contacted").length}
          </p>
          <p className="text-sm text-[#6B7280]">Contacted</p>
        </div>
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4">
          <p className="text-2xl font-bold text-green-600">
            {submissions.filter((s) => s.status === "booked").length}
          </p>
          <p className="text-sm text-[#6B7280]">Booked</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            id="form-submissions-search"
            name="form-submissions-search"
            aria-label="Search form submissions"
            type="text"
            placeholder="Search submissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
          />
        </div>
        <div className="flex gap-2">
          <select
            id="form-submissions-form-filter"
            name="form-submissions-form-filter"
            aria-label="Filter submissions by form"
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value)}
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111]"
          >
            <option value="">All Forms</option>
            {formOptions.map((formName) => (
              <option key={formName} value={formName}>
                {formName}
              </option>
            ))}
          </select>
          <select
            id="form-submissions-status-filter"
            name="form-submissions-status-filter"
            aria-label="Filter submissions by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111]"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {selectedSubmissions.length > 0 && (
        <div
          className="border border-[rgba(110,106,232,0.2)] rounded-[24px] p-4 flex items-center justify-between"
          style={{ backgroundColor: "rgba(110, 106, 232, 0.08)" }}
        >
          <span className="text-sm text-[#111111]">
            {selectedSubmissions.length} submissions selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void addSubmissionsToPipeline(selectedRows)}
              disabled={selectedRows.length === 0 || selectedRows.every((submission) => submission.pipelineDealId)}
              className="px-3 py-1.5 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl text-sm text-[#111111] hover:bg-[#F6F3EF]"
            >
              Add to Pipeline
            </button>
            <button
              type="button"
              onClick={() => emailSubmissions(selectedRows)}
              className="px-3 py-1.5 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl text-sm text-[#111111] hover:bg-[#F6F3EF]"
            >
              Send Email
            </button>
            <button
              type="button"
              onClick={() => void archiveSubmissions(selectedRows)}
              disabled={selectedRows.length === 0}
              className="px-3 py-1.5 bg-red-500/10 text-red-600 rounded-xl text-sm hover:bg-red-500/20 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {selectedSubmission && (
        <div className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-[#111111]">
                {selectedSubmission.name}
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                {selectedSubmission.formName} submitted on{" "}
                {new Date(selectedSubmission.submittedAt).toLocaleString("en-GB")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSubmission(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-[#6B7280] hover:bg-[#FAF8F5]"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[#6B7280]">Email</p>
              <p className="font-medium text-[#111111]">{selectedSubmission.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-[#6B7280]">Phone</p>
              <p className="font-medium text-[#111111]">{selectedSubmission.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-[#6B7280]">Treatment</p>
              <p className="font-medium text-[#111111]">{selectedSubmission.treatment || "N/A"}</p>
            </div>
            <div>
              <p className="text-[#6B7280]">Source</p>
              <p className="font-medium text-[#111111]">{selectedSubmission.source || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  <input
                    aria-label="Select all visible form submissions"
                    type="checkbox"
                    checked={
                      filteredSubmissions.length > 0 &&
                      selectedSubmissions.length === filteredSubmissions.length
                    }
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-[rgba(0,0,0,0.12)] bg-[#FAF8F5]"
                  />
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Contact
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Form
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Treatment
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Source
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                  Submitted
                </th>
                <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} className="border-b border-[rgba(0,0,0,0.04)]">
                    {Array.from({ length: 7 }, (_, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <SkeletonLine className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filteredSubmissions.map((submission) => {
                const config = statusConfig[submission.status];
                const StatusIcon = config.icon;
                const isMutating = mutatingIds.includes(submission.id);
                return (
                  <tr
                    key={submission.id}
                    className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#FAF8F5]"
                  >
                    <td className="px-5 py-4">
                      <input
                        aria-label={`Select submission from ${submission.name}`}
                        type="checkbox"
                        checked={selectedSubmissions.includes(submission.id)}
                        onChange={() => toggleSelection(submission.id)}
                        className="w-4 h-4 rounded border-[rgba(0,0,0,0.12)] bg-[#FAF8F5]"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, #6E6AE8, #8B87F0)",
                          }}
                        >
                          {submission.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#111111]">
                            {submission.name}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {submission.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280]">
                      {submission.formName}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#111111]">
                      {submission.treatment}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280]">
                      {submission.source}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit ${config.color}`}
                      >
                        <StatusIcon className="w-3 h-3" /> {submission.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#6B7280]">
                      {submission.submittedAt}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(submission)}
                          aria-label={`View submission from ${submission.name}`}
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
                        >
                          <Eye className="w-4 h-4 text-[#6B7280]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => emailSubmissions([submission])}
                          aria-label={`Email ${submission.name}`}
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
                        >
                          <Mail className="w-4 h-4 text-[#6B7280]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void addSubmissionsToPipeline([submission])}
                          disabled={isMutating || Boolean(submission.pipelineDealId)}
                          aria-label={`Add ${submission.name} to pipeline`}
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
                        >
                          <GitBranch className="w-4 h-4 text-[#6B7280]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void archiveSubmissions([submission])}
                          disabled={isMutating}
                          aria-label={`Archive submission from ${submission.name}`}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(submission)}
                          aria-label={`More options for ${submission.name}`}
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
                        >
                          <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredSubmissions.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-sm text-[#6B7280]" colSpan={7}>
                    No form submissions loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
