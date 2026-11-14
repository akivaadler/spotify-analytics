"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/data-context";
import { DEEP_CATS, DEEP_METRICS, type DeepCat } from "@/lib/deep";
import { MetricView } from "./MetricView";

export function DeepCuts() {
  const { deep, scope } = useData();
  const [cat, setCat] = useState<DeepCat | "all">("all");
  const results = useMemo(() => deep(scope), [deep, scope]);
  const shown = cat === "all" ? results : results.filter((r) => r.m.cat === cat);
  const missing = DEEP_METRICS.filter((m) => !results.some((r) => r.m.id === m.id) && (cat === "all" || m.cat === cat));
  const color = (c: DeepCat) => DEEP_CATS.find((x) => x.id === c)!.color;

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-5xl font-extrabold sm:text-6xl">
          Deep cuts<span className="text-lime">.</span>
        </h2>
        <p className="text-sm text-cream/55">
          {results.length} of {DEEP_METRICS.length} have enough data for {scope === "all" ? "all time" : scope}
        </p>
      </div>
      <p className="mt-3 max-w-2xl text-cream/70">
        Behavioural analysis from how each play started and ended. It separates the songs you chose from the ones that played on their own, catches the ones you wore out, and finds the ones you keep coming back to.
      </p>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all" as const, label: "All", color: "bg-cream" }, ...DEEP_CATS].map((c) => {
          const n = c.id === "all" ? results.length : results.filter((r) => r.m.cat === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold transition ${
                cat === c.id ? "border-cream bg-cream text-ink" : "border-white/15 text-cream/75 hover:border-white/40"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
              {c.label}
              <span className="opacity-50">{n}</span>
            </button>
          );
        })}
      </div>
      {cat !== "all" && <p className="mt-3 text-sm text-cream/55">{DEEP_CATS.find((c) => c.id === cat)?.blurb}</p>}

      <div className="mt-6 grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {shown.map(({ m, out }) => (
          <article key={m.id} className="rounded-[1.75rem] bg-ink-2 p-5 sm:p-6">
            <header className="mb-4 flex items-start gap-3">
              <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${color(m.cat)}`} />
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-extrabold">{m.title}</h3>
                <p className="mt-0.5 text-sm text-cream/55">{m.desc}</p>
              </div>
            </header>
            <MetricView out={out} unit={m.unit} />
          </article>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-5 text-xs text-cream/40">
          Not enough data for this period: {missing.map((m) => m.title).join(" · ")}
        </p>
      )}
    </section>
  );
}
