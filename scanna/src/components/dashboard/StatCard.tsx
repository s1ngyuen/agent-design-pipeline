export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-paper p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-50">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-50">{hint}</p>}
    </div>
  );
}
