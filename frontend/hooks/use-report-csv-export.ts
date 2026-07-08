"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import { downloadCsvText } from "@/lib/client-download";
import { useToast } from "@/lib/toast-context";
import type {
  DashboardQueryParams,
  ReportExportType,
} from "@/lib/api-client/reports-ops-api";

type ExportTone = "success" | "error" | "warning";

export interface ReportExportStatus {
  message: string;
  tone: ExportTone;
}

export function useReportCsvExport({
  params,
  token,
  type,
}: {
  params?: DashboardQueryParams;
  token?: string;
  type: ReportExportType;
}) {
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<ReportExportStatus | null>(
    null,
  );

  const exportCsv = useCallback(async () => {
    if (!token) {
      const message = "Sign in before downloading this report export.";
      setExportStatus({
        tone: "error",
        message,
      });
      addToast(message, "error");
      return;
    }

    setIsExporting(true);
    setExportStatus(null);

    try {
      const result = await api.reports.exportCsv(token, type, params);
      downloadCsvText(result.filename, result.content);

      if (result.empty) {
        const message =
          "No backend records matched this export range. Downloaded the empty-state CSV from the backend.";
        setExportStatus({
          tone: "warning",
          message,
        });
        addToast(message, "warning", 4500);
        return;
      }

      const message = `${result.filename} downloaded with ${result.rowCount} row${result.rowCount === 1 ? "" : "s"}.`;
      setExportStatus({
        tone: "success",
        message,
      });
      addToast(message, "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Report CSV export could not be downloaded.";
      setExportStatus({
        tone: "error",
        message,
      });
      addToast(message, "error", 4500);
    } finally {
      setIsExporting(false);
    }
  }, [addToast, params, token, type]);

  return {
    exportCsv,
    exportStatus,
    isExporting,
  };
}
