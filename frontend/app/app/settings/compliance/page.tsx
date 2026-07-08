"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Upload,
  Lock,
  Users,
  Trash2,
  Download,
  Eye,
} from "lucide-react";
import {
  PageHeader,
  Card,
  StatCard,
  StatCardSkeleton,
  AlertBanner,
  Toggle,
  SettingRow,
  TableRowSkeleton,
} from "@/components/ui";
import { DataTable, TableRow, TableCell } from "@/components/ui/tables";
import { FilterTabs } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import type {
  ComplianceDocumentRecord,
  ComplianceSettingsRecord,
  DataAccessRequestRecord,
  DataAccessRequestStatus,
  DataAccessRequestType,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  COMPLIANCE_FILE_ACCEPT,
  downloadDataUrl,
  readComplianceFileDataUrl,
  validateComplianceFile,
} from "@/lib/compliance-files";

const statusConfig: Record<
  string,
  { colorClass: string; icon: typeof CheckCircle; label: string }
> = {
  complete: {
    colorClass: "bg-green-50 text-green-600 border-green-200/60",
    icon: CheckCircle,
    label: "Complete",
  },
  action_required: {
    colorClass: "bg-red-50 text-red-500 border-red-200/60",
    icon: AlertTriangle,
    label: "Action Required",
  },
  expiring_soon: {
    colorClass: "bg-amber-50 text-amber-600 border-amber-200/60",
    icon: Clock,
    label: "Expiring Soon",
  },
};

const dataProtectionSettings = [
  {
    title: "Data Retention Period",
    desc: "How long to keep patient records",
    type: "select" as const,
  },
  {
    title: "Auto-delete Inactive Leads",
    desc: "Remove leads with no activity",
    type: "toggle" as const,
    enabled: true,
  },
  {
    title: "Consent Tracking",
    desc: "Track marketing consent for all contacts",
    type: "toggle" as const,
    enabled: true,
  },
];

const FILTER_TABS = [
  "All",
  "GDPR",
  "Clinical",
  "Training",
  "Insurance",
  "Regulatory",
];

const dataAccessStatusLabels: Record<DataAccessRequestStatus, string> = {
  received: "Received",
  verifying_identity: "Verifying Identity",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const dataAccessTypeLabels: Record<DataAccessRequestType, string> = {
  access: "Access",
  erasure: "Erasure",
  rectification: "Rectification",
  portability: "Portability",
  restriction: "Restriction",
};

export default function CompliancePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [documents, setDocuments] =
    useState<ComplianceDocumentRecord[]>([]);
  const [dataAccessRequests, setDataAccessRequests] = useState<
    DataAccessRequestRecord[]
  >([]);
  const [settings, setSettings] = useState<ComplianceSettingsRecord>({
    retentionPeriod: "7 years",
    toggles: {
      autoDeleteInactiveLeads: true,
      consentTracking: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fileMutationId, setFileMutationId] = useState<string | null>(null);
  const [requestMutationId, setRequestMutationId] = useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    requestType: "access" as DataAccessRequestType,
    dueDate: "",
    notes: "",
  });
  const completeCount = documents.filter(
    (i) => i.status === "complete",
  ).length;
  const actionCount = documents.filter(
    (i) => i.status === "action_required" || i.status === "expiring_soon",
  ).length;

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadCompliance() {
      setIsLoading(true);
      try {
        const [documentRows, settingRows, requestRows] = await Promise.all([
          api.compliance.listDocuments(session!.token),
          api.compliance.getSettings(session!.token),
          api.compliance.listDataAccessRequests(session!.token),
        ]);

        if (!cancelled) {
          setDocuments(documentRows);
          setSettings(settingRows);
          setDataAccessRequests(requestRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load compliance", error);
        if (!cancelled) {
          setDocuments([]);
          setDataAccessRequests([]);
          setStatusMessage(
            error instanceof Error
              ? `Live compliance data could not load: ${error.message}`
              : "Live compliance data could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCompliance();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const filteredItems = documents.filter(
    (item) => activeTab === "all" || item.category === activeTab,
  );

  const handleUploadDocument = async () => {
    if (!session?.token) return;
    const title = window.prompt("Document title");
    if (!title) return;

    try {
      const created = await api.compliance.createDocument(session.token, {
        title,
        status: "action_required",
        category: "gdpr",
      });
      setDocuments((items) => [
        {
          id: created.id,
          title,
          status: "action_required",
          category: "gdpr",
          lastUpdated: new Date().toISOString(),
          dueDate: null,
          fileName: null,
          mimeType: null,
          sizeBytes: null,
          hasFile: false,
        },
        ...items,
      ]);
      setStatusMessage("Compliance document created.");
    } catch (error) {
      console.error("Failed to create compliance document", error);
      setStatusMessage("Could not create document.");
    }
  };

  const handleDocumentFileSelect = async (
    document: ComplianceDocumentRecord,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    if (!session?.token) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateComplianceFile(file);
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setFileMutationId(document.id);
    setStatusMessage(null);

    try {
      const dataUrl = await readComplianceFileDataUrl(file);
      const uploaded = await api.compliance.uploadDocumentFile(
        session.token,
        document.id,
        {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl,
        },
      );
      setDocuments((items) =>
        items.map((item) =>
          item.id === document.id
            ? {
                ...item,
                status: "complete",
                fileName: uploaded.fileName,
                mimeType: uploaded.mimeType,
                sizeBytes: uploaded.sizeBytes,
                hasFile: true,
                lastUpdated: uploaded.updatedAt,
              }
            : item,
        ),
      );
      setStatusMessage(`${uploaded.fileName} uploaded securely.`);
    } catch (error) {
      console.error("Failed to upload compliance file", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not upload file.",
      );
    } finally {
      setFileMutationId(null);
    }
  };

  const handleDownloadDocumentFile = async (
    document: ComplianceDocumentRecord,
  ) => {
    if (!session?.token) return;

    setFileMutationId(document.id);
    setStatusMessage(null);

    try {
      const file = await api.compliance.getDocumentFile(
        session.token,
        document.id,
      );
      downloadDataUrl(file.dataUrl, file.fileName);
      setStatusMessage(`${file.fileName} downloaded.`);
    } catch (error) {
      console.error("Failed to download compliance file", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not download file.",
      );
    } finally {
      setFileMutationId(null);
    }
  };

  const handlePreviewDocumentFile = async (
    document: ComplianceDocumentRecord,
  ) => {
    if (!session?.token) return;

    setFileMutationId(document.id);
    setStatusMessage(null);

    try {
      const file = await api.compliance.getDocumentFile(
        session.token,
        document.id,
      );
      const preview = window.open("", "_blank", "noopener,noreferrer");
      if (!preview) {
        downloadDataUrl(file.dataUrl, file.fileName);
        setStatusMessage("Preview was blocked, so the file was downloaded.");
        return;
      }
      preview.document.write(
        `<iframe src="${file.dataUrl}" title="${file.fileName}" style="border:0;width:100%;height:100vh"></iframe>`,
      );
      preview.document.close();
      setStatusMessage(`${file.fileName} opened for preview.`);
    } catch (error) {
      console.error("Failed to preview compliance file", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not preview file.",
      );
    } finally {
      setFileMutationId(null);
    }
  };

  const handleDeleteDocumentFile = async (
    document: ComplianceDocumentRecord,
  ) => {
    if (!session?.token) return;
    if (!window.confirm(`Remove the stored file for ${document.title}?`)) return;

    setFileMutationId(document.id);
    setStatusMessage(null);

    try {
      await api.compliance.deleteDocumentFile(session.token, document.id);
      setDocuments((items) =>
        items.map((item) =>
          item.id === document.id
            ? {
                ...item,
                status: "action_required",
                fileName: null,
                mimeType: null,
                sizeBytes: null,
                hasFile: false,
                lastUpdated: new Date().toISOString(),
              }
            : item,
        ),
      );
      setStatusMessage("Stored compliance file removed.");
    } catch (error) {
      console.error("Failed to delete compliance file", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not remove file.",
      );
    } finally {
      setFileMutationId(null);
    }
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!session?.token) return;

    const nextSettings = {
      ...settings,
      toggles: { ...settings.toggles, [key]: value },
    };
    setSettings(nextSettings);

    try {
      const updated = await api.compliance.updateSettings(
        session.token,
        nextSettings,
      );
      setSettings(updated);
    } catch (error) {
      console.error("Failed to update compliance settings", error);
      setStatusMessage("Could not update compliance settings.");
    }
  };

  const handleRetentionChange = async (retentionPeriod: string) => {
    if (!session?.token) return;

    const nextSettings = { ...settings, retentionPeriod };
    setSettings(nextSettings);

    try {
      const updated = await api.compliance.updateSettings(
        session.token,
        nextSettings,
      );
      setSettings(updated);
    } catch (error) {
      console.error("Failed to update retention period", error);
      setStatusMessage("Could not update retention period.");
    }
  };

  const handleDocumentStatusChange = async (
    document: ComplianceDocumentRecord,
    status: ComplianceDocumentRecord["status"],
  ) => {
    if (!session?.token) return;
    const previousDocuments = documents;
    setDocuments((items) =>
      items.map((item) => (item.id === document.id ? { ...item, status } : item)),
    );

    try {
      await api.compliance.updateDocument(session.token, document.id, { status });
      setStatusMessage("Compliance document updated.");
    } catch (error) {
      console.error("Failed to update compliance document", error);
      setDocuments(previousDocuments);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not update document.",
      );
    }
  };

  const handleDeleteDocument = async (document: ComplianceDocumentRecord) => {
    if (!session?.token) return;
    if (!window.confirm(`Delete ${document.title}?`)) return;

    try {
      await api.compliance.removeDocument(session.token, document.id);
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      setStatusMessage("Compliance document deleted.");
    } catch (error) {
      console.error("Failed to delete compliance document", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not delete document.",
      );
    }
  };

  const handleCreateDataAccessRequest = async () => {
    if (!session?.token) return;
    if (!requestForm.requesterName.trim()) {
      setStatusMessage("Requester name is required.");
      return;
    }

    setRequestMutationId("new");
    setStatusMessage(null);

    try {
      const created = await api.compliance.createDataAccessRequest(
        session.token,
        {
          requesterName: requestForm.requesterName.trim(),
          requesterEmail: requestForm.requesterEmail.trim() || null,
          requesterPhone: requestForm.requesterPhone.trim() || null,
          requestType: requestForm.requestType,
          dueDate: requestForm.dueDate || null,
          notes: requestForm.notes.trim() || null,
        },
      );
      setDataAccessRequests((items) => [created, ...items]);
      setRequestForm({
        requesterName: "",
        requesterEmail: "",
        requesterPhone: "",
        requestType: "access",
        dueDate: "",
        notes: "",
      });
      setStatusMessage("Data access request created.");
    } catch (error) {
      console.error("Failed to create data access request", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not create data access request.",
      );
    } finally {
      setRequestMutationId(null);
    }
  };

  const handleDataAccessStatusChange = async (
    request: DataAccessRequestRecord,
    status: DataAccessRequestStatus,
  ) => {
    if (!session?.token) return;

    setRequestMutationId(request.id);
    setStatusMessage(null);

    try {
      const updated = await api.compliance.updateDataAccessRequest(
        session.token,
        request.id,
        { status },
      );
      setDataAccessRequests((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setStatusMessage("Data access request updated.");
    } catch (error) {
      console.error("Failed to update data access request", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not update data access request.",
      );
    } finally {
      setRequestMutationId(null);
    }
  };

  const handleArchiveDataAccessRequest = async (
    request: DataAccessRequestRecord,
  ) => {
    if (!session?.token) return;
    if (!window.confirm(`Archive request for ${request.requesterName}?`)) return;

    setRequestMutationId(request.id);
    setStatusMessage(null);

    try {
      await api.compliance.archiveDataAccessRequest(session.token, request.id);
      setDataAccessRequests((items) =>
        items.filter((item) => item.id !== request.id),
      );
      setStatusMessage("Data access request archived.");
    } catch (error) {
      console.error("Failed to archive data access request", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not archive data access request.",
      );
    } finally {
      setRequestMutationId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & GDPR"
        subtitle="Manage compliance documents and data protection."
        right={
          <button
            onClick={handleUploadDocument}
            disabled={isLoading || !session?.token}
            className="btn-primary disabled:opacity-60"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Compliance data notice"
          description={statusMessage}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Compliance Score"
              value={`${Math.round((completeCount / Math.max(documents.length, 1)) * 100)}%`}
              icon={Shield}
              color="indigo"
            />
            <StatCard
              label="Complete"
              value={String(completeCount)}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              label="Needs Attention"
              value={String(actionCount)}
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              label="Total Documents"
              value={String(documents.length)}
              icon={FileText}
              color="blue"
            />
          </>
        )}
      </div>

      {actionCount > 0 && (
        <AlertBanner
          icon={AlertTriangle}
          title={`${actionCount} items need your attention`}
          description="Review and update the items marked below to maintain compliance."
          variant="warning"
        />
      )}

      <FilterTabs
        tabs={FILTER_TABS}
        active={activeTab}
        onChange={(tab) => setActiveTab(tab)}
      />

      <DataTable
        headers={[
          { label: "Document" },
          { label: "Category" },
          { label: "Status" },
          { label: "Last Updated" },
          { label: "Due Date" },
          { label: "" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 5 }, (_, index) => (
            <TableRowSkeleton key={`compliance-loading-${index}`} columns={6} />
          ))}
        {!isLoading && filteredItems.length === 0 && (
          <tr>
            <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
              {activeTab === "all"
                ? "No compliance documents have been created yet."
                : `No ${activeTab} compliance documents found.`}
            </td>
          </tr>
        )}
        {!isLoading && filteredItems.map((item) => {
          const config = statusConfig[item.status] || statusConfig.complete;
          const StatusIcon = config.icon;
          return (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#6B7280]" />
                  <span className="font-medium text-[#111111]">
                    {item.title}
                  </span>
                </div>
                {item.hasFile && item.fileName && (
                  <p className="mt-1 pl-7 text-xs text-[#6B7280]">
                    Stored file: {item.fileName}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs bg-[rgba(0,0,0,0.03)] px-2 py-1 rounded text-[#6B7280] capitalize">
                  {item.category}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 w-fit ${config.colorClass}`}
                  >
                    <StatusIcon className="w-3 h-3" /> {config.label}
                  </span>
                  <select
                    value={item.status}
                    onChange={(event) =>
                      handleDocumentStatusChange(
                        item,
                        event.target.value as ComplianceDocumentRecord["status"],
                      )
                    }
                    className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-2 py-1 text-xs text-[#111111]"
                  >
                    <option value="complete">Complete</option>
                    <option value="action_required">Action required</option>
                    <option value="expiring_soon">Expiring soon</option>
                  </select>
                </div>
              </TableCell>
              <TableCell className="text-[#6B7280] text-sm">
                {formatDate(item.lastUpdated)}
              </TableCell>
              <TableCell className="text-[#6B7280] text-sm">
                {formatDate(item.dueDate)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <input
                    id={`compliance-file-${item.id}`}
                    type="file"
                    accept={COMPLIANCE_FILE_ACCEPT}
                    className="hidden"
                    onChange={(event) => void handleDocumentFileSelect(item, event)}
                  />
                  <label
                    htmlFor={`compliance-file-${item.id}`}
                    className="cursor-pointer p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)]"
                    aria-label={`Upload file for ${item.title}`}
                  >
                    <Upload className="w-4 h-4 text-[#6B7280]" />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handlePreviewDocumentFile(item)}
                    disabled={!item.hasFile || fileMutationId === item.id}
                    className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-40"
                    aria-label={`Preview ${item.title}`}
                  >
                    <Eye className="w-4 h-4 text-[#6B7280]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadDocumentFile(item)}
                    disabled={!item.hasFile || fileMutationId === item.id}
                    className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-40"
                    aria-label={`Download ${item.title}`}
                  >
                    <Download className="w-4 h-4 text-[#6B7280]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteDocumentFile(item)}
                    disabled={!item.hasFile || fileMutationId === item.id}
                    className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-40"
                    aria-label={`Remove stored file for ${item.title}`}
                  >
                    <Trash2 className="w-4 h-4 text-amber-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(item)}
                    className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)]"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
            <Lock className="w-5 h-5 text-violet-500" /> Data Protection
            Settings
          </h2>
          <div className="space-y-4">
            {dataProtectionSettings.map((setting) => (
              <SettingRow
                key={setting.title}
                title={setting.title}
                description={setting.desc}
              >
                {setting.type === "select" ? (
                  <select
                    value={settings.retentionPeriod}
                    onChange={(event) =>
                      handleRetentionChange(event.target.value)
                    }
                    className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-lg px-3 py-1.5 text-sm text-[#111111]"
                  >
                    <option>7 years</option>
                    <option>10 years</option>
                    <option>Indefinite</option>
                  </select>
                ) : (
                  <Toggle
                    enabled={
                      settings.toggles[
                        setting.title === "Auto-delete Inactive Leads"
                          ? "autoDeleteInactiveLeads"
                          : "consentTracking"
                      ] ??
                      setting.enabled ??
                      false
                    }
                    onChange={(enabled) =>
                      handleToggleSetting(
                        setting.title === "Auto-delete Inactive Leads"
                          ? "autoDeleteInactiveLeads"
                          : "consentTracking",
                        enabled,
                      )
                    }
                  />
                )}
              </SettingRow>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
            <Users className="w-5 h-5 text-blue-500" /> Data Access Requests
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={requestForm.requesterName}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      requesterName: event.target.value,
                    }))
                  }
                  placeholder="Requester name"
                  className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-sm text-[#111111]"
                />
                <input
                  value={requestForm.requesterEmail}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      requesterEmail: event.target.value,
                    }))
                  }
                  placeholder="Email"
                  type="email"
                  className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-sm text-[#111111]"
                />
                <select
                  value={requestForm.requestType}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      requestType: event.target.value as DataAccessRequestType,
                    }))
                  }
                  className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-sm text-[#111111]"
                >
                  {Object.entries(dataAccessTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={requestForm.dueDate}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  type="date"
                  className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-sm text-[#111111]"
                />
              </div>
              <textarea
                value={requestForm.notes}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Notes"
                className="mt-3 w-full rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-sm text-[#111111]"
              />
              <button
                type="button"
                onClick={() => void handleCreateDataAccessRequest()}
                disabled={requestMutationId === "new"}
                className="mt-3 rounded-lg bg-[#111111] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {requestMutationId === "new" ? "Creating..." : "Create Request"}
              </button>
            </div>

            <div className="space-y-2">
              {isLoading && (
                <div className="rounded-lg bg-[rgba(0,0,0,0.02)] p-4 text-sm text-[#6B7280]">
                  Loading requests...
                </div>
              )}
              {!isLoading && dataAccessRequests.length === 0 && (
                <div className="rounded-lg bg-[rgba(0,0,0,0.02)] p-4 text-sm text-[#6B7280]">
                  No data access requests recorded yet.
                </div>
              )}
              {!isLoading && dataAccessRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#111111]">
                        {request.requesterName}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {dataAccessTypeLabels[request.requestType]} request
                        {request.dueDate ? ` due ${formatDate(request.dueDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={request.status}
                        onChange={(event) =>
                          void handleDataAccessStatusChange(
                            request,
                            event.target.value as DataAccessRequestStatus,
                          )
                        }
                        disabled={requestMutationId === request.id}
                        className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-white px-2 py-1 text-xs text-[#111111] disabled:opacity-50"
                      >
                        {Object.entries(dataAccessStatusLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleArchiveDataAccessRequest(request)}
                        disabled={requestMutationId === request.id}
                        className="rounded-lg p-1.5 hover:bg-white disabled:opacity-50"
                        aria-label={`Archive request for ${request.requesterName}`}
                      >
                        <Trash2 className="h-4 w-4 text-[#6B7280]" />
                      </button>
                    </div>
                  </div>
                  {request.notes && (
                    <p className="mt-2 text-xs text-[#6B7280]">{request.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
