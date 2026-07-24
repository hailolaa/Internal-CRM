// ============================================================
// CSV / PDF Export Utilities — front-end data export
// ============================================================

/**
 * Convert an array of objects to CSV string and trigger download.
 */
export function toCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";

  const text = Array.isArray(value) ? value.join("; ") : String(value);
  const spreadsheetSafe =
    typeof value !== "number" &&
    /^(?:[=+\-@\t\r]|[ \t\r]+[=+\-@])/.test(text)
      ? `'${text}`
      : text;

  return /[",\n\r]/.test(spreadsheetSafe)
    ? `"${spreadsheetSafe.replace(/"/g, '""')}"`
    : spreadsheetSafe;
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.map(toCsvCell).join(","),
    ...data.map((row) =>
      headers
        .map((h) => toCsvCell(row[h]))
        .join(","),
    ),
  ];

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Convert data to a simple text report and trigger download as .txt
 * (PDF generation requires a library — this is the Phase 1 fallback)
 */
export function exportToText(
  data: Record<string, unknown>[],
  filename: string,
  title: string,
) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const colWidths = headers.map((h) =>
    Math.max(h.length, ...data.map((row) => String(row[h] ?? "").length)),
  );

  const separator = colWidths.map((w) => "-".repeat(w + 2)).join("+");
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ");

  const rows = data.map((row) =>
    headers
      .map((h, i) => String(row[h] ?? "").padEnd(colWidths[i]))
      .join(" | "),
  );

  const report = [
    title,
    `Exported: ${new Date().toLocaleString("en-GB")}`,
    `Records: ${data.length}`,
    "",
    separator,
    headerRow,
    separator,
    ...rows,
    separator,
  ].join("\n");

  const blob = new Blob([report], { type: "text/plain;charset=utf-8;" });
  triggerDownload(blob, `${filename}.txt`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
