"use client";

import {
  Plus,
  Mail,
  Phone,
  Tag,
  ChevronDown,
  Upload,
  Download,
  CheckCircle,
  Trash2,
  Edit3,
  ExternalLink,
  FileText,
  AlertTriangle,
  Loader2,
  Users,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Avatar,
  StatusBadge,
  SearchInput,
  Card,
  SkeletonLine,
  TableRowSkeleton,
  AlertBanner,
} from "@/components/ui";
import {
  TableRow,
  TableCell,
  MoreButton,
} from "@/components/ui/tables";
import {
  SortableHeader,
  PaginationControls,
} from "@/components/ui/table-controls";
import { api } from "@/lib/api-client";
import type { ContactRecord, ContactSortBy, ContactSortOrder } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { saveBlobDownload } from "@/lib/download";

type ContactTableRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  tags: string[];
  lastContact: string;
  value: string;
  avatar: string;
  raw: ContactRecord;
};

const CONTACT_PAGE_SIZE = 25;

const DEFAULT_STATUS_OPTIONS = [
  "lead",
  "prospect",
  "contacted",
  "qualified",
  "discovery_call_booked",
  "proposal_sent",
  "client",
  "active",
  "lost",
];

const DEFAULT_TAG_OPTIONS = [
  "Clinic Growth Score",
  "Growth Diagnostic",
  "Lead Concierge",
  "Performance OS",
  "Growth Engine",
  "Market Leader",
  "SEO",
  "Google Ads",
  "Meta Ads",
  "Website",
  "Referral",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFilterLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLastContact(contact: ContactRecord) {
  const value = contact.lastContactAt || contact.updatedAt || contact.createdAt;
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toContactRow(contact: ContactRecord): ContactTableRow {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email || "—",
    phone: contact.phone || "—",
    source: contact.source || "Unknown",
    status: contact.status || "Lead",
    tags: contact.tags || contact.treatmentInterests || [],
    lastContact: formatLastContact(contact),
    value: formatMoney(contact.value || 0),
    avatar: contact.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    raw: contact,
  };
}

export default function ContactsPage() {
  const router = useRouter();
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canDeleteContacts = hasPermission("contacts:delete");
  const canWriteContacts = hasPermission("contacts:write");
  const canWriteProposals = hasPermission("proposals:write");
  const [contacts, setContacts] = useState<ContactTableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<ContactSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<ContactSortOrder>("desc");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: CONTACT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionContactId, setActionContactId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      if (!token) return;

      setIsLoading(true);
      try {
        const result = await api.contacts.list(token, {
          page: currentPage,
          pageSize: CONTACT_PAGE_SIZE,
          search: searchQuery.trim() || undefined,
          status: selectedStatus === "all" ? undefined : selectedStatus,
          tag: selectedTag === "all" ? undefined : selectedTag,
          sortBy,
          sortDir,
        });
        if (!isMounted) return;
        setLoadError("");
        const rows = result.contacts.map(toContactRow);
        setContacts(rows);
        setPagination({
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: Math.max(1, result.pagination.totalPages),
        });
      } catch (err) {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load contacts from the backend.",
        );
        setContacts([]);
        setPagination({
          page: 1,
          limit: CONTACT_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentPage, searchQuery, selectedStatus, selectedTag, sortBy, sortDir, token]);

  const statusOptions = useMemo(() => {
    const statuses = new Set([
      ...DEFAULT_STATUS_OPTIONS,
      ...contacts.map((contact) => contact.status).filter(Boolean),
    ]);
    return Array.from(statuses).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const tagOptions = useMemo(() => {
    const tags = new Set([
      ...DEFAULT_TAG_OPTIONS,
      ...contacts.flatMap((contact) => contact.tags).filter(Boolean),
    ]);
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const contactStats = useMemo(() => {
    const leadCount = contacts.filter((contact) =>
      contact.status.toLowerCase().includes("lead") ||
      contact.status.toLowerCase().includes("prospect"),
    ).length;
    const bookedCount = contacts.filter((contact) =>
      contact.status.toLowerCase().includes("book") ||
      contact.status.toLowerCase().includes("discovery"),
    ).length;
    const pipelineValue = contacts.reduce((total, contact) => {
      const numericValue = Number(contact.value.replace(/[^\d.-]/g, ""));
      return total + (Number.isFinite(numericValue) ? numericValue : 0);
    }, 0);

    return { leadCount, bookedCount, pipelineValue };
  }, [contacts]);

  const toggleSort = useCallback((key: string) => {
    const nextSortBy = key as ContactSortBy;
    setCurrentPage(1);
    setSortBy((currentSortBy) => {
      if (currentSortBy !== nextSortBy) {
        setSortDir("asc");
        return nextSortBy;
      }
      setSortDir((currentSortDir) => (currentSortDir === "asc" ? "desc" : "asc"));
      return currentSortBy;
    });
  }, []);

  const getSortDirection = useCallback(
    (key: string) => (sortBy === key ? sortDir : null),
    [sortBy, sortDir],
  );

  const totalPages = pagination.totalPages;
  const totalItems = pagination.total;
  const startIndex = totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, totalItems);
  const hasPrevPage = pagination.page > 1;
  const hasNextPage = pagination.page < totalPages;
  const nextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }, [totalPages]);
  const prevPage = useCallback(() => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }, []);
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  const handleExport = useCallback(async () => {
    if (!token || isExporting) return;

    setIsExporting(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await api.contacts.exportCsv(token, {
        search: searchQuery.trim() || undefined,
        status: selectedStatus === "all" ? undefined : selectedStatus,
        tag: selectedTag === "all" ? undefined : selectedTag,
        page: 1,
        pageSize: 5000,
      });
      saveBlobDownload(result.blob, result.fileName);
      setActionMessage("Contact export downloaded.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not export contacts.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, searchQuery, selectedStatus, selectedTag, token]);

  const refreshContact = useCallback(
    async (contactId: string) => {
      if (!token) return;
      const contact = await api.contacts.get(token, contactId);
      const row = toContactRow(contact);
      setContacts((current) =>
        current.map((item) => (item.id === contactId ? row : item)),
      );
    },
    [token],
  );

  const handleMarkContacted = useCallback(
    async (contact: ContactTableRow) => {
      if (!token) return;
      if (!canWriteContacts) {
        setActionError("You do not have permission to update contacts.");
        setOpenMenuId(null);
        return;
      }
      setActionContactId(contact.id);
      setActionError("");
      setActionMessage("");
      try {
        await api.contacts.markContacted(token, contact.id);
        await refreshContact(contact.id);
        setActionMessage(`${contact.name} marked as contacted.`);
        setOpenMenuId(null);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not mark contact as contacted.",
        );
      } finally {
        setActionContactId(null);
      }
    },
    [canWriteContacts, refreshContact, token],
  );

  const handleAddToPipeline = useCallback(
    async (contact: ContactTableRow) => {
      if (!token) return;
      if (!canWriteContacts) {
        setActionError("You do not have permission to add contacts to pipeline.");
        setOpenMenuId(null);
        return;
      }

      setActionContactId(contact.id);
      setActionError("");
      setActionMessage("");
      try {
        await api.pipelineDeals.create(token, {
          contactId: contact.id,
          title: `${contact.name} opportunity`,
          valueCents: Math.round((contact.raw.value || 0) * 100),
          source: contact.raw.source,
          treatment: contact.raw.treatmentInterests[0] || null,
        });
        setActionMessage(`${contact.name} added to pipeline.`);
        setOpenMenuId(null);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not add contact to pipeline.",
        );
      } finally {
        setActionContactId(null);
      }
    },
    [canWriteContacts, token],
  );

  const handleDeleteContact = useCallback(
    async (contact: ContactTableRow) => {
      if (!token) return;
      if (!canDeleteContacts) {
        setActionError("You do not have permission to delete contacts.");
        setOpenMenuId(null);
        return;
      }
      const confirmed = window.confirm(`Delete ${contact.name}? This will remove the contact from active lists.`);
      if (!confirmed) return;

      setActionContactId(contact.id);
      setActionError("");
      setActionMessage("");
      try {
        await api.contacts.remove(token, contact.id);
        setContacts((current) => current.filter((item) => item.id !== contact.id));
        setPagination((current) => {
          const nextTotal = Math.max(0, current.total - 1);
          return {
            ...current,
            total: nextTotal,
            totalPages: Math.max(1, Math.ceil(nextTotal / current.limit)),
          };
        });
        if (contacts.length === 1 && currentPage > 1) {
          setCurrentPage((page) => Math.max(1, page - 1));
        }
        setActionMessage(`${contact.name} deleted.`);
        setOpenMenuId(null);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not delete contact.",
        );
      } finally {
        setActionContactId(null);
      }
    },
    [canDeleteContacts, contacts.length, currentPage, token],
  );

  const resetFilters = useCallback(() => {
    setSelectedStatus("all");
    setSelectedTag("all");
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Manage prospects, client contacts, and account stakeholders in one internal list."
        icon={Users}
        right={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting || !token}
              className="btn-secondary text-sm disabled:opacity-60"
            >
              <Download className="w-4 h-4" /> {isExporting ? "Exporting" : "Export CSV"}
            </button>
            <button
              onClick={() => router.push("/app/crm/contacts/import")}
              className="btn-secondary text-sm"
            >
              <Upload className="w-4 h-4" /> Import
            </button>
            <button
              onClick={() => router.push("/app/crm/contacts/new")}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-16 mb-2" />
          ) : (
            <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
          )}
          <p className="text-sm text-[#6F6A66]">
            {isLoading ? "Loading contacts" : "Total Contacts"}
          </p>
        </Card>
        <Card padding="p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-16 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-blue-600">
              {contactStats.leadCount}
            </p>
          )}
          <p className="text-sm text-[#6F6A66]">Visible Prospects</p>
        </Card>
        <Card padding="p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-16 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-emerald-600">
              {contactStats.bookedCount}
            </p>
          )}
          <p className="text-sm text-[#6F6A66]">Visible Booked Calls</p>
        </Card>
        <Card padding="p-4">
          {isLoading ? (
            <SkeletonLine className="h-8 w-24 mb-2" />
          ) : (
            <p className="text-2xl font-bold text-[#5648D8]">
              {formatMoney(contactStats.pipelineValue)}
            </p>
          )}
          <p className="text-sm text-[#6F6A66]">Visible Pipeline Value</p>
        </Card>
      </div>

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend contacts could not be loaded"
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
          title="Contact action failed"
          description={actionError}
          variant="warning"
        />
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          placeholder="Search by name, email, phone, source, tag..."
          className="flex-1"
        />
        <span className="text-xs text-[#9E9890] whitespace-nowrap">
          {isLoading
            ? "Searching contacts..."
            : `${totalItems.toLocaleString()} matching contact${totalItems === 1 ? "" : "s"}`}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">Filter by status</span>
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A746A]" />
            <select
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setCurrentPage(1);
              }}
              className="btn-secondary appearance-none py-2 pl-9 pr-8 text-sm"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatFilterLabel(status)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#7A746A]" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by tag</span>
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A746A]" />
            <select
              value={selectedTag}
              onChange={(event) => {
                setSelectedTag(event.target.value);
                setCurrentPage(1);
              }}
              className="btn-secondary appearance-none py-2 pl-9 pr-8 text-sm"
            >
              <option value="all">All tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#7A746A]" />
          </label>
          {(selectedStatus !== "all" || selectedTag !== "all") && (
            <button onClick={resetFilters} className="btn-secondary text-sm">
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFCF9",
          border: "1px solid #E7E1DA",
          boxShadow: "0 2px 12px rgba(27, 29, 34, 0.05)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #E7E1DA",
                  backgroundColor: "#F6F3EF",
                }}
              >
                <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 w-10 text-[#9E9890]">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#E7E1DA]"
                  />
                </th>
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  direction={getSortDirection("name")}
                  onSort={toggleSort}
                />
                <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 hidden md:table-cell text-[#9E9890]">
                  Contact
                </th>
                <SortableHeader
                  label="Source"
                  sortKey="source"
                  direction={getSortDirection("source")}
                  onSort={toggleSort}
                  className="hidden lg:table-cell"
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  direction={getSortDirection("status")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Value"
                  sortKey="value"
                  direction={getSortDirection("value")}
                  onSort={toggleSort}
                  className="hidden lg:table-cell"
                />
                <SortableHeader
                  label="Last Contact"
                  sortKey="lastContact"
                  direction={getSortDirection("lastContact")}
                  onSort={toggleSort}
                  className="hidden md:table-cell"
                />
                <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 w-10 text-[#9E9890]" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, index) => (
                  <TableRowSkeleton key={index} columns={8} />
                ))}
              {!isLoading && contacts.map((contact) => (
                <Fragment key={contact.id}>
                <TableRow>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#E7E1DA]"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={contact.name} size="sm" />
                      <div className="min-w-0">
                        <span className="font-medium block truncate">
                          {contact.name}
                        </span>
                        <span className="text-xs text-[#9E9890] md:hidden">
                          {contact.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-[#6F6A66]">
                        <Mail className="w-3 h-3 flex-shrink-0" />{" "}
                        <span className="truncate">{contact.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#6F6A66]">
                        <Phone className="w-3 h-3 flex-shrink-0" />{" "}
                        {contact.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#6F6A66] hidden lg:table-cell">
                    {contact.source}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contact.status} />
                  </TableCell>
                  <TableCell className="font-medium text-[#5648D8] hidden lg:table-cell">
                    {contact.value}
                  </TableCell>
                  <TableCell className="text-sm text-[#9E9890] hidden md:table-cell">
                    {contact.lastContact}
                  </TableCell>
                  <TableCell>
                    <MoreButton
                      label={`More options for ${contact.name}`}
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === contact.id ? null : contact.id,
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
                {openMenuId === contact.id && (
                  <tr key={`${contact.id}-actions`}>
                    <td colSpan={8} className="px-5 py-0">
                      <div
                        className="mb-3 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-[#151f21]">{contact.name}</p>
                            <p className="text-xs text-[#6F6A66]">
                              Open the live contact profile, update details, or run backend contact actions.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                router.push(`/app/crm/contacts/detail?id=${contact.id}`)
                              }
                              className="btn-secondary text-sm"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => handleMarkContacted(contact)}
                              disabled={!canWriteContacts || actionContactId === contact.id}
                              className="btn-secondary text-sm"
                            >
                              {actionContactId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              Mark Contacted
                            </button>
                            <button
                              onClick={() =>
                                router.push(`/app/crm/contacts/edit?id=${contact.id}`)
                              }
                              disabled={!canWriteContacts}
                              className="btn-secondary text-sm disabled:opacity-60"
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit
                            </button>
                            {canWriteProposals ? (
                              <button
                                onClick={() =>
                                  router.push(`/app/crm/proposals/call-mode?contactId=${encodeURIComponent(contact.id)}`)
                                }
                                className="btn-secondary text-sm"
                              >
                                <FileText className="h-4 w-4" />
                                Start Proposal Call
                              </button>
                            ) : null}
                            <a
                              href={`mailto:${contact.raw.email || ""}`}
                              className={`btn-secondary text-sm ${contact.raw.email ? "" : "pointer-events-none opacity-50"}`}
                            >
                              <Mail className="h-4 w-4" />
                              Email
                            </a>
                            <a
                              href={`tel:${contact.raw.phone || ""}`}
                              className={`btn-secondary text-sm ${contact.raw.phone ? "" : "pointer-events-none opacity-50"}`}
                            >
                              <Phone className="h-4 w-4" />
                              Call
                            </a>
                            <button
                              onClick={() => handleAddToPipeline(contact)}
                              disabled={!canWriteContacts || actionContactId === contact.id}
                              className="btn-secondary text-sm disabled:opacity-60"
                            >
                              {actionContactId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              Add to Pipeline
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact)}
                              disabled={!canDeleteContacts || actionContactId === contact.id}
                              className="btn-secondary text-sm text-[#9a5524] disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {!isLoading && contacts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-[#9E9890]"
                  >
                    No contacts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={pagination.page}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          onPrevious={prevPage}
          onNext={nextPage}
          onGoToPage={goToPage}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
        />
      </div>
    </div>
  );
}
