"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Plus, Trash2 } from "lucide-react";
import {
  AlertBanner,
  Card,
  DataTable,
  PageHeader,
  StatusBadge,
  TableCell,
  TableRow,
  TableRowSkeleton,
} from "@/components/ui";
import { SearchInput } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import type { SopRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function SOPsPage() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sops, setSops] = useState<SopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadSops() {
      setIsLoading(true);
      try {
        const rows = await api.sops.list(session!.token, {
          search: searchQuery.trim() || undefined,
        });
        if (!cancelled) {
          setSops(rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load SOPs", error);
        if (!cancelled) {
          setSops([]);
          setStatusMessage(
            error instanceof Error
              ? `Live SOPs could not load: ${error.message}`
              : "Live SOPs could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSops();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, session]);

  const filteredSops = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return sops;
    return sops.filter((sop) =>
      [sop.title, sop.category, sop.owner, sop.content]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [searchQuery, sops]);

  const handleCreateSop = async () => {
    if (!session?.token) return;
    const title = window.prompt("SOP title");
    if (!title) return;

    try {
      const created = await api.sops.create(session.token, {
        title,
        category: "Operations",
        status: "draft",
      });
      setSops((items) => [
        {
          id: created.id,
          title,
          category: "Operations",
          content: null,
          owner: null,
          status: "draft",
          updatedAt: new Date().toISOString(),
        },
        ...items,
      ]);
      setStatusMessage("SOP created.");
    } catch (error) {
      console.error("Failed to create SOP", error);
      setStatusMessage("Could not create SOP.");
    }
  };

  const handlePublishToggle = async (sop: SopRecord) => {
    if (!session?.token) return;
    const status = sop.status === "published" ? "draft" : "published";

    try {
      await api.sops.update(session.token, sop.id, { status });
      setSops((items) =>
        items.map((item) => (item.id === sop.id ? { ...item, status } : item)),
      );
    } catch (error) {
      console.error("Failed to update SOP", error);
      setStatusMessage("Could not update SOP.");
    }
  };

  const handleDeleteSop = async (sop: SopRecord) => {
    if (!session?.token) return;
    if (!window.confirm(`Delete ${sop.title}?`)) return;

    try {
      await api.sops.remove(session.token, sop.id);
      setSops((items) => items.filter((item) => item.id !== sop.id));
      setStatusMessage("SOP deleted.");
    } catch (error) {
      console.error("Failed to delete SOP", error);
      setStatusMessage("Could not delete SOP.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOPs"
        subtitle="Standard operating procedures for your clinic."
        right={
          <button
            onClick={handleCreateSop}
            disabled={isLoading || !session?.token}
            className="btn-primary disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Create SOP
          </button>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="SOP data notice"
          description={statusMessage}
          variant="warning"
        />
      )}

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-container bg-[rgba(110,106,232,0.08)]">
            <BookOpen className="w-5 h-5 text-[#6E6AE8]" />
          </div>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search SOPs..."
            className="max-w-md"
          />
          {isLoading && (
            <span className="text-xs font-semibold text-[#5e8a8d]">
              Loading live SOPs...
            </span>
          )}
        </div>

        <DataTable
          headers={[
            { label: "SOP" },
            { label: "Category" },
            { label: "Owner" },
            { label: "Status" },
            { label: "Updated" },
            { label: "" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <TableRowSkeleton key={`sop-loading-${index}`} columns={6} />
            ))}
          {!isLoading && filteredSops.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {searchQuery.trim()
                  ? "No live SOPs match that search."
                  : "No SOPs have been created for this clinic yet."}
              </td>
            </tr>
          )}
          {!isLoading && filteredSops.map((sop) => (
            <TableRow key={sop.id}>
              <TableCell className="font-medium text-[#111111]">
                {sop.title}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {sop.category}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {sop.owner ?? "-"}
              </TableCell>
              <TableCell>
                <StatusBadge status={sop.status} />
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {formatDate(sop.updatedAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePublishToggle(sop)}
                    disabled={isLoading}
                    className="text-xs text-[#6E6AE8] hover:text-[#5A56D4] disabled:opacity-60"
                  >
                    {sop.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => handleDeleteSop(sop)}
                    disabled={isLoading}
                    aria-label={`Delete ${sop.title}`}
                    className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
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
