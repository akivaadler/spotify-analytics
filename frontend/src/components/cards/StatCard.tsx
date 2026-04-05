import { COLORS } from "@/lib/constants";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.surface2}` }}
      className="p-4 flex flex-col gap-1"
    >
      <div style={{ color: COLORS.textMuted }} className="text-xs font-medium uppercase tracking-wider">
        {label}
      </div>
      <div
        style={{ color: accent ? COLORS.green : COLORS.text }}
        className="text-2xl font-bold leading-tight"
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: COLORS.textMuted }} className="text-xs">
          {sub}
        </div>
      )}
    </div>
  );
}
