export function formatMs(ms: number): string {
  if (!ms || ms < 0) return "0m";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHours(hours: number): string {
  if (!hours) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatNumber(n: number): string {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat().format(n);
}

export function formatPct(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function msToHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 10) / 10;
}
