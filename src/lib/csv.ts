/**
 * Minimal CSV writer for exports. Cells that start with = + - @ or a control
 * character are prefixed with an apostrophe so Excel and Sheets read them as
 * text instead of running them as formulas (CSV injection).
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Saves text as a file from the browser. */
export function downloadCsv(filename: string, csv: string) {
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
