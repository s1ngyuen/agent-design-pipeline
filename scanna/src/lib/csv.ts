// Hand-rolled CSV writer for inventory export (plan.md §1a — "papaparse or
// a hand-rolled CSV writer"; hand-rolled here to avoid an extra dependency
// for a single, simple flattening job).

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = typeof value === 'string' ? value : JSON.stringify(value);

  // Formula-injection guard: this export is explicitly for tax/accounting
  // use (brief.md), and a cell starting with =, +, -, or @ becomes a live
  // formula when opened in Excel/Sheets (e.g. a `notes` field containing
  // `=HYPERLINK(...)`). Prefix with a leading apostrophe to force those
  // spreadsheet apps to treat the cell as literal text — applied before the
  // existing quote/escape logic below so the apostrophe itself still gets
  // wrapped/escaped correctly if the value also needs quoting.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvCell).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}
