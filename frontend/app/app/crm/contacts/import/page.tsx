"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  Users,
  Mail,
  Phone,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ContactImportResult, ContactImportRow } from "@/lib/api-types";

type PreviewRow = ContactImportRow & {
  rowNumber: number;
  name: string;
  validationStatus: "valid" | "invalid";
  validationErrors: string[];
};

const templateHeaders = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "tags",
  "source",
  "status",
  "servicePackage",
  "notes",
];

const headerAliases: Record<string, keyof ContactImportRow | "tags"> = {
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  fullname: "firstName",
  name: "firstName",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  phonenumber: "phone",
  tags: "tags",
  tag: "tags",
  source: "source",
  leadsource: "source",
  status: "status",
  notes: "notes",
  note: "notes",
  service: "treatmentInterests",
  servicepackage: "treatmentInterests",
  package: "treatmentInterests",
  packageinterest: "treatmentInterests",
  treatment: "treatmentInterests",
  treatmentinterest: "treatmentInterests",
  treatmentinterests: "treatmentInterests",
};

function normaliseHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDelimitedLine(line: string, delimiter: "," | "\t") {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function parseContactImportText(text: string): PreviewRow[] {
  const delimiter = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = parseDelimitedLine(lines[0] || "", delimiter).map((header) =>
    headerAliases[normaliseHeader(header)] || normaliseHeader(header),
  );

  return lines.slice(1).map((line, index) => {
    const values = parseDelimitedLine(line, delimiter);
    const raw: Record<string, string> = {};
    headers.forEach((header, valueIndex) => {
      raw[header] = values[valueIndex] || "";
    });

    const firstName = raw.firstName || raw.firstname || raw.first || "";
    const lastName = raw.lastName || raw.lastname || raw.last || "";
    const email = raw.email || "";
    const phone = raw.phone || raw.mobile || "";
    const tags = (raw.tags || "")
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const treatmentInterests = (raw.treatmentInterests || raw.treatment || "")
      .split(/[;,]/)
      .map((treatment) => treatment.trim())
      .filter(Boolean);
    const validationErrors: string[] = [];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push("Invalid email");
    }
    if (!email && !phone.trim() && !firstName && !lastName) {
      validationErrors.push("Email, phone, or name required");
    }

    return {
      rowNumber: index + 2,
      firstName,
      lastName,
      email,
      phone,
      tags,
      source: raw.source || "Import",
      status: raw.status || "lead",
      notes: raw.notes || undefined,
      treatmentInterests,
      name: [firstName, lastName].filter(Boolean).join(" ") || "Unnamed",
      validationStatus: validationErrors.length === 0 ? "valid" : "invalid",
      validationErrors,
    };
  });
}

function downloadTemplate() {
  const csv = `${templateHeaders.join(",")}\nSarah,Johnson,sarah@example.com,07700 900123,imported,CSV,lead,Website build,Initial enquiry`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "growth-group-contact-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function toImportRow(row: PreviewRow): ContactImportRow {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    tags: row.tags,
    source: row.source,
    status: row.status,
    notes: row.notes,
    treatmentInterests: row.treatmentInterests,
  };
}

export default function ImportContactsPage() {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importSource, setImportSource] = useState<"csv" | "paste" | "sheets">("csv");
  const [importing, setImporting] = useState(false);
  const [previewingSheet, setPreviewingSheet] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mode, setMode] = useState<"create_only" | "upsert">("create_only");
  const [tagInput, setTagInput] = useState("");
  const [importResult, setImportResult] = useState<ContactImportResult | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const validRows = previewRows.filter(
    (row) => row.validationStatus === "valid",
  );
  const invalidRows = previewRows.length - validRows.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setStatusMessage(null);

      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        setPreviewRows([]);
        setStatusMessage("CSV import is live. Convert Excel files to CSV first.");
        setStep(2);
        return;
      }

      selectedFile
        .text()
        .then((text) => {
          setPreviewRows(parseContactImportText(text));
          setImportSource("csv");
          setStep(2);
        })
        .catch((error) => {
          console.error("Failed to parse contact import file", error);
          setStatusMessage("Could not read the selected file.");
        });
    }
  };

  const handlePastePreview = () => {
    const rows = parseContactImportText(pasteText);
    if (rows.length === 0) {
      setStatusMessage("Paste rows with a header line first, then at least one contact row.");
      return;
    }

    setFile(null);
    setImportSource("paste");
    setPreviewRows(rows);
    setStatusMessage(null);
    setStep(2);
  };

  const handleSheetsPreview = async () => {
    if (!session?.token) {
      setStatusMessage("Sign in to preview Google Sheets imports.");
      return;
    }

    if (!sheetUrl.trim()) {
      setStatusMessage("Paste a published Google Sheets URL first.");
      return;
    }

    setPreviewingSheet(true);
    setStatusMessage(null);
    try {
      const preview = await api.contacts.previewImportSource(
        session.token,
        sheetUrl.trim(),
      );
      const rows = preview.rows.map((row, index) => {
        const previewRow = {
          rowNumber: index + 2,
          ...row,
          name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed",
          validationStatus: "valid" as const,
          validationErrors: [] as string[],
        };
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          previewRow.validationErrors.push("Invalid email");
        }
        if (!row.email && !row.phone?.trim() && !row.firstName && !row.lastName) {
          previewRow.validationErrors.push("Email, phone, or name required");
        }
        return {
          ...previewRow,
          validationStatus: previewRow.validationErrors.length === 0 ? "valid" as const : "invalid" as const,
        };
      });

      setFile(null);
      setSourceUrl(sheetUrl.trim());
      setImportSource("sheets");
      setPreviewRows(rows);
      setStep(2);
    } catch (error) {
      console.error("Failed to preview Google Sheets import", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not preview the Google Sheet.",
      );
    } finally {
      setPreviewingSheet(false);
    }
  };

  const handleImport = async () => {
    if (!session?.token) {
      setStatusMessage("Sign in to import contacts.");
      return;
    }

    if (!validRows.length) {
      setStatusMessage("No valid rows to import.");
      return;
    }

    setImporting(true);
    setStatusMessage(null);

    const extraTags = tagInput
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const result = await api.contacts.importContacts(session.token, {
        filename: file?.name,
        ...(importSource === "paste" ? { filename: "pasted-contacts" } : {}),
        ...(importSource === "sheets" ? { filename: "google-sheets", sourceUrl } : {}),
        mode,
        rows: validRows.map((row) => ({
          ...toImportRow(row),
          tags: [...(row.tags || []), ...extraTags],
        })),
      });
      setImportResult(result);
      setStep(3);
    } catch (error) {
      console.error("Failed to import contacts", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not import contacts.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/contacts"
          className="p-2 rounded-[14px] hover:bg-[rgba(0,0,0,0.08)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import Contacts</h1>
          <p className="text-[#6B7280] text-sm">
            Bulk import contacts from CSV or pasted spreadsheet rows
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${step >= s ? "bg-[#6E6AE8]" : "bg-[rgba(0,0,0,0.08)]"}`}
          />
        ))}
      </div>

      {statusMessage && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-8">
              <div className="border-2 border-dashed border-[rgba(0,0,0,0.12)] rounded-[24px] p-12 text-center hover:border-[rgba(110,106,232,0.4)] transition-colors">
                <input
                  id="file-upload"
                  name="contacts-import-csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="w-16 h-16 rounded-2xl bg-[rgba(110,106,232,0.08)] flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-[#6E6AE8]" />
                  </div>
                  <p className="font-semibold mb-2">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    Supports CSV files. Paste import is available below.
                  </p>
                </label>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
                <span className="text-sm text-[#6B7280]">or</span>
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="p-4 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] text-left">
                  <FileSpreadsheet className="w-6 h-6 text-[#A8A39B] mb-2" />
                  <p className="font-medium">Google Sheets</p>
                  <p className="text-xs text-[#6B7280]">
                    Import from a published sheet URL or CSV export link.
                  </p>
                  <input
                    id="contacts-import-sheet-url"
                    name="contacts-import-sheet-url"
                    aria-label="Google Sheets URL"
                    type="url"
                    value={sheetUrl}
                    onChange={(event) => setSheetUrl(event.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="mt-3 w-full rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                  />
                  <button
                    type="button"
                    onClick={handleSheetsPreview}
                    disabled={previewingSheet}
                    className="mt-3 w-full rounded-[14px] bg-[#6E6AE8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5A56D4] disabled:opacity-50"
                  >
                    {previewingSheet ? "Previewing..." : "Preview Sheet"}
                  </button>
                </div>
                <div
                  className="p-4 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] text-left"
                >
                  <FileSpreadsheet className="w-6 h-6 text-blue-400 mb-2" />
                  <p className="font-medium">Copy & Paste</p>
                  <p className="text-xs text-[#6B7280] mb-3">
                    Paste rows copied from Sheets or Excel with a header row.
                  </p>
                  <textarea
                    id="contacts-import-pasted-rows"
                    name="contacts-import-pasted-rows"
                    aria-label="Pasted contact rows"
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    placeholder={`firstName\tlastName\temail\tphone\ttags\nSarah\tJohnson\tsarah@example.com\t07700 900123\twebsite build`}
                    className="min-h-28 w-full resize-y rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3 text-xs text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                  />
                  <button
                    type="button"
                    onClick={handlePastePreview}
                    className="mt-3 w-full rounded-[14px] bg-[#6E6AE8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5A56D4]"
                  >
                    Preview Pasted Rows
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5">
              <h3 className="font-semibold mb-3">Download Template</h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Use our template to ensure your data imports correctly.
              </p>
              <button
                onClick={downloadTemplate}
                className="w-full py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] flex items-center justify-center gap-2 hover:bg-[rgba(0,0,0,0.08)] text-sm"
              >
                <Download className="w-4 h-4" /> Download CSV Template
              </button>
            </div>

            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5">
              <h3 className="font-semibold mb-3">Required Fields</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#6B7280]" /> Email, phone, or name
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#6B7280]" /> First Name
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#6B7280]" /> Last Name
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#6B7280]" /> Phone
                </li>
                <li className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#6B7280]" /> Tags
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-400" />
                <div>
                  <p className="font-medium">
                    {importSource === "paste"
                      ? "Pasted contacts"
                      : importSource === "sheets"
                        ? "Google Sheets contacts"
                        : file?.name || "contacts.csv"}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {previewRows.length} rows detected
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPasteText("");
                  setSheetUrl("");
                  setSourceUrl("");
                  setImportSource("csv");
                  setStep(1);
                }}
                className="p-2 hover:bg-[rgba(0,0,0,0.08)] rounded-[14px]"
              >
                <X className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5">
            <h3 className="font-semibold mb-4">Preview & Validation</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <th className="text-left text-xs text-[#6B7280] font-medium px-4 py-2">
                      Status
                    </th>
                    <th className="text-left text-xs text-[#6B7280] font-medium px-4 py-2">
                      Name
                    </th>
                    <th className="text-left text-xs text-[#6B7280] font-medium px-4 py-2">
                      Email
                    </th>
                    <th className="text-left text-xs text-[#6B7280] font-medium px-4 py-2">
                      Phone
                    </th>
                    <th className="text-left text-xs text-[#6B7280] font-medium px-4 py-2">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`border-b border-[rgba(0,0,0,0.04)] ${row.validationStatus === "invalid" ? "bg-red-500/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        {row.validationStatus === "valid" ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{row.name}</td>
                      <td className="px-4 py-3 text-sm">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-[#6B7280]">
                        {row.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500">
                        {row.validationErrors.join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">{validRows.length} valid</span>
                <span className="text-red-400">{invalidRows} invalid</span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="w-4 h-4 rounded accent-[#6E6AE8]"
                />
                Invalid rows will be skipped
              </label>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5">
            <h3 className="font-semibold mb-4">Import Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Duplicate handling
                </label>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as "create_only" | "upsert")
                  }
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm"
                >
                  <option value="create_only">Skip duplicates</option>
                  <option value="upsert">Update existing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Add tags
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="e.g. imported, jan-2026"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] hover:bg-[rgba(0,0,0,0.08)]"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2.5 bg-[#6E6AE8] text-white font-medium rounded-[14px] hover:bg-[#5A56D4] disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing
                ? "Importing..."
                : `Import ${validRows.length} Contacts`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Import Complete!</h2>
          <p className="text-[#6B7280] mb-6">
            Imported {importResult?.insertedRows ?? 0} new contacts
            {importResult?.updatedRows
              ? ` and updated ${importResult.updatedRows}`
              : ""}
          </p>
          <div className="mx-auto mb-6 grid max-w-xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3">
              <p className="font-semibold text-[#111111]">{importResult?.totalRows ?? 0}</p>
              <p className="text-[#6B7280]">Rows</p>
            </div>
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3">
              <p className="font-semibold text-[#111111]">{importResult?.duplicateRows ?? 0}</p>
              <p className="text-[#6B7280]">Duplicates</p>
            </div>
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3">
              <p className="font-semibold text-[#111111]">{importResult?.errorRows ?? 0}</p>
              <p className="text-[#6B7280]">Errors</p>
            </div>
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3">
              <p className="font-semibold text-[#111111]">{importResult?.status ?? "completed"}</p>
              <p className="text-[#6B7280]">Status</p>
            </div>
          </div>
          {importResult?.errors?.length ? (
            <div className="mx-auto mb-6 max-w-xl rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
              {importResult.errors.slice(0, 5).map((error) => (
                <p key={`${error.rowNumber}-${error.message}`}>
                  Row {error.rowNumber}: {error.message}
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex justify-center gap-3">
            <Link
              href="/app/crm/contacts"
              className="px-6 py-2.5 bg-[#6E6AE8] text-white font-medium rounded-[14px] hover:bg-[#5A56D4]"
            >
              View Contacts
            </Link>
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setPasteText("");
                setSheetUrl("");
                setSourceUrl("");
                setImportSource("csv");
              }}
              className="px-6 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] hover:bg-[rgba(0,0,0,0.08)]"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
