export function csvCell(value: unknown) {
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

export function csvRows(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
