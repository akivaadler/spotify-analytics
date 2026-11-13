"use client";

import type { MetricOutput } from "@/lib/sandbox";
import { HBars, Line, VBars } from "./ui";

const fmt = (v: number, unit: string) => {
  const n = Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
};

export function MetricView({ out, unit, large = false }: { out: MetricOutput; unit: string; large?: boolean }) {
  if (out.viz === "number") {
    return (
      <div>
        <p className={`font-display font-extrabold text-lime ${large ? "text-[clamp(3.5rem,16vw,7rem)]" : "text-5xl"} [overflow-wrap:anywhere]`}>
          {typeof out.value === "number" ? fmt(out.value, unit) : out.value}
        </p>
        {out.caption && <p className="mt-2 text-cream/70">{out.caption}</p>}
      </div>
    );
  }
  if (!out.items.length) return <p className="text-cream/60">Nothing to show for this period.</p>;
  if (out.viz === "list") return <HBars items={out.items.slice(0, large ? 6 : 10)} color="bg-lime" format={(v) => fmt(v, unit)} />;
  if (out.viz === "line") return <Line items={out.items} color="#ff4fb8" height={large ? 200 : 140} />;
  return <VBars items={out.items} color="#d4ff3a" height={large ? 200 : 140} format={(v) => fmt(v, unit)} />;
}
