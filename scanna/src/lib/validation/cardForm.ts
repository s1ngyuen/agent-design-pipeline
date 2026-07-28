// Validation helpers for the manual-correction / manual-entry card form,
// copy per content.md "Validation errors".

export function validateRequired(label: string, value: string): string | null {
  return value.trim() ? null : `${label} is required.`;
}

const YEAR_RE = /^(19|20)\d{2}(\/\d{2})?$/;
export function validateYear(value: string): string | null {
  if (!value.trim()) return "Year is required.";
  return YEAR_RE.test(value.trim()) ? null : "Enter a year like 2025 or 2025/26.";
}

export function validatePrintRun(value: string): string | null {
  if (!value.trim()) return null; // optional
  return /^\d+$/.test(value.trim()) ? null : "Print run should be a number, like 250.";
}

export function validateGradeGrader(grade: string, grader: string): string | null {
  if (grade.trim() && (!grader.trim() || grader === "None")) {
    return "Pick who graded it, or clear the grade field.";
  }
  return null;
}

export function validatePrice(value: string): string | null {
  if (!value.trim()) return "Enter a price like 24.99.";
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) ? null : "Enter a price like 24.99.";
}
