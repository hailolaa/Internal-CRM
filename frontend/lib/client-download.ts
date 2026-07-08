"use client";

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function normaliseCell(value: CsvRow[string]) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  if (typeof window === "undefined" || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = normaliseCell(row[header]);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadCsvText(filename: string, content: string) {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function rowsFromTables(container: HTMLElement): CsvRow[] {
  const tables = Array.from(container.querySelectorAll("table"));
  return tables.flatMap((table, tableIndex) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell, index) => {
      const text = cell.textContent?.trim();
      return text || `Column ${index + 1}`;
    });

    return Array.from(table.querySelectorAll("tbody tr")).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells.reduce<CsvRow>(
        (acc, cell, index) => {
          acc[headers[index] || `Column ${index + 1}`] = cell.textContent?.trim() || "";
          return acc;
        },
        { Table: tableIndex + 1 },
      );
    });
  });
}
