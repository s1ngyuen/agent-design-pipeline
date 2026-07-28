import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ label, hint, error, htmlFor, required, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden="true" className="text-plum"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-50">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "min-h-[44px] w-full rounded-lg border border-border bg-paper px-3 text-base text-ink placeholder:text-ink-50 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1 disabled:bg-bone-100 disabled:text-ink-50";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, className, required, ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        className={cn(inputBase, className)}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  hint,
  error,
  id,
  options,
  placeholder,
  className,
  required,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <select
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        className={cn(inputBase, "appearance-none bg-paper", className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, id, required, ...props }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        className={cn(inputBase, "min-h-[88px] py-2")}
        {...props}
      />
    </FieldShell>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="text-xs text-ink-50">{hint}</p>}
      </div>
      {/* Outer button is the actual hit target — 44x44 minimum per
       * accessibility.md's touch-target rule, even though the visible
       * track is deliberately smaller (a full 44px-tall switch would look
       * oversized next to the rest of this form). The colored track is a
       * decorative inner span, centered within the larger invisible
       * clickable area. */}
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full",
          "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-flex h-7 w-12 items-center rounded-full transition-colors",
            checked ? "bg-gold" : "bg-slate-soft",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-paper shadow transition-transform",
              checked ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
      </button>
    </div>
  );
}
