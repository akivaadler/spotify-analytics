"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/data-context";
import type { Scope } from "@/lib/types";

export function Wordmark({ className = "", dot = "text-lime" }: { className?: string; dot?: string }) {
  return (
    <span className={`font-display text-2xl font-extrabold tracking-tight ${className}`}>
      encore<span className={dot}>.</span>
    </span>
  );
}

export function Nav() {
  const path = usePathname();
  const { status } = useData();
  const links = [
    { href: "/story", label: "Story" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/lab", label: "Metric Lab" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Home">
          <Wordmark />
        </Link>
        {status === "ready" && (
          <nav className="no-scrollbar ml-auto flex gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  path === l.href ? "bg-cream text-ink" : "text-cream/70 hover:bg-white/10 hover:text-cream"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function ScopePicker({ allowAll = true }: { allowAll?: boolean }) {
  const { years, scope, setScope } = useData();
  const opts: Scope[] = [...[...years].reverse(), ...(allowAll ? (["all"] as const) : [])];
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {opts.map((y) => (
        <button
          key={String(y)}
          onClick={() => setScope(y)}
          className={`shrink-0 rounded-full border px-4 py-1.5 font-display text-lg font-bold transition ${
            scope === y ? "border-lime bg-lime text-ink" : "border-white/15 text-cream/80 hover:border-white/40"
          }`}
        >
          {y === "all" ? "All time" : y}
        </button>
      ))}
    </div>
  );
}

/* ───────────── decorative shapes ───────────── */

export function Blob({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <path
        fill={color}
        d="M43.5,-58.6C55.7,-50.3,64.1,-36.1,68.9,-20.6C73.7,-5.1,74.9,11.7,68.8,25.4C62.7,39.2,49.3,49.9,34.6,57.9C19.9,65.9,3.9,71.2,-12.9,70.5C-29.7,69.8,-47.3,63.1,-58.5,50.5C-69.7,37.9,-74.5,19.5,-73.4,1.9C-72.3,-15.8,-65.3,-31.5,-54,-40.4C-42.7,-49.3,-27.1,-51.3,-12.4,-56.7C2.3,-62.1,31.3,-66.9,43.5,-58.6Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}

export function Starburst({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 62 : 100;
    const a = (i / 24) * Math.PI * 2;
    pts.push(`${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`);
  }
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}

export function Rings({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden fill="none" stroke={color} strokeWidth="10">
      {[90, 68, 46, 24].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} />
      ))}
    </svg>
  );
}

export function Squiggle({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 300 60" className={className} aria-hidden fill="none" stroke={color} strokeWidth="12" strokeLinecap="round">
      <path d="M8 30 Q 30 0 52 30 T 96 30 T 140 30 T 184 30 T 228 30 T 272 30" />
    </svg>
  );
}

/* ───────────── charts ───────────── */

export function HBars({
  items,
  color = "bg-lime",
  format = (v: number) => Math.round(v).toLocaleString(),
}: {
  items: { label: string; sub?: string; value: number }[];
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[1.6rem_1fr] items-center gap-2">
          <span className="font-display text-lg font-bold text-cream/50">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold">{it.label}</span>
              <span className="shrink-0 tabular-nums text-sm text-cream/70">{format(it.value)}</span>
            </div>
            {it.sub && <div className="truncate text-xs text-cream/50">{it.sub}</div>}
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className={`h-full origin-left animate-grow rounded-full ${color}`} style={{ width: `${(it.value / max) * 100}%`, animationDelay: `${i * 60}ms` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function VBars({
  items,
  color = "#d4ff3a",
  height = 140,
  highlight,
  format = (v: number) => Math.round(v).toLocaleString(),
}: {
  items: { label: string; value: number }[];
  color?: string;
  height?: number;
  highlight?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  const every = Math.ceil(items.length / 12);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {items.map((it, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full origin-bottom rounded-t-[3px] transition-opacity group-hover:opacity-100"
              style={{ height: `${Math.max(1.5, (it.value / max) * 100)}%`, background: color, opacity: highlight === undefined || highlight === i ? 1 : 0.45 }}
            />
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-cream px-2 py-1 text-xs font-semibold text-ink group-hover:block">
              {it.label}: {format(it.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-cream/50">
        {items.map((it, i) => (
          <div key={i} className="flex-1 truncate text-center">
            {i % every === 0 ? it.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Line({ items, color = "#ff4fb8", height = 140 }: { items: { label: string; value: number }[]; color?: string; height?: number }) {
  if (items.length < 2) return <VBars items={items} color={color} height={height} />;
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  const min = Math.min(0, ...items.map((i) => i.value));
  const W = 600;
  const pts = items.map((it, i) => [(i / (items.length - 1)) * W, height - ((it.value - min) / (max - min || 1)) * (height - 10) - 5]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const every = Math.ceil(items.length / 8);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <path d={`${d} L${W},${height} L0,${height} Z`} fill={color} opacity="0.15" />
        <path d={d} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-cream/50">
        {items.filter((_, i) => i % every === 0).map((it, i) => (
          <span key={i}>{it.label}</span>
        ))}
      </div>
    </div>
  );
}

/** 24-hour radial clock. */
export function Clock({ hours, color = "#d4ff3a", size = 260, label = true }: { hours: number[]; color?: string; size?: number; label?: boolean }) {
  const max = Math.max(1e-9, ...hours);
  const c = 100;
  const inner = 34;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="max-w-full">
      <circle cx={c} cy={c} r={inner - 4} fill="none" stroke="currentColor" strokeOpacity="0.15" />
      {hours.map((v, h) => {
        const a0 = ((h - 6) / 24) * Math.PI * 2 + 0.03;
        const a1 = ((h - 5) / 24) * Math.PI * 2 - 0.03;
        const r = inner + (v / max) * (96 - inner);
        const p = (a: number, rr: number) => `${c + rr * Math.cos(a)},${c + rr * Math.sin(a)}`;
        return <path key={h} d={`M${p(a0, inner)} L${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} L${p(a1, inner)} Z`} fill={color} opacity={0.35 + 0.65 * (v / max)} />;
      })}
      {label &&
        [0, 6, 12, 18].map((h) => {
          const a = ((h - 6) / 24) * Math.PI * 2;
          return (
            <text key={h} x={c + 22 * Math.cos(a)} y={c + 22 * Math.sin(a) + 3} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.7" fontWeight="700">
              {h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
            </text>
          );
        })}
    </svg>
  );
}

export function Meter({ value, color = "bg-lime" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full origin-left animate-grow rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}
