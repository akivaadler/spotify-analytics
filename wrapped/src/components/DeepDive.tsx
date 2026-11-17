"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, type CustomMetric } from "@/lib/data-context";
import { runOne } from "@/lib/deep";
import { buildIndex, profile, resolve, type EntityRef } from "@/lib/entity";
import { sandbox, type MetricOutput } from "@/lib/sandbox";
import { fmtDay, fmtInt } from "@/lib/analytics";
import { MetricView } from "./MetricView";
import { HBars, Line, VBars } from "./ui";

/* ───────────── "Refine with AI" hand-off to the Lab ───────────── */

export interface RefineSeed {
  title?: string;
  description?: string;
  unit?: string;
  code?: string;
  prompt?: string;
}

export function useRefine() {
  const router = useRouter();
  return (seed: RefineSeed) => {
    try {
      sessionStorage.setItem("encore.refine", JSON.stringify(seed));
    } catch {
      /* private mode: the Lab still opens, just without the context */
    }
    router.push("/lab?refine=1");
  };
}

export function MetricActions({ onDive, onRefine }: { onDive?: () => void; onRefine: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
      {onDive && (
        <button onClick={onDive} className="rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-bold text-cream/85 transition hover:bg-white/15">
          Deep dive →
        </button>
      )}
      <button onClick={onRefine} className="rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-bold text-pink transition hover:bg-pink hover:text-ink">
        Refine with AI ✦
      </button>
    </div>
  );
}

/* ───────────── the panel ───────────── */

export type DiveSource =
  | { kind: "deep"; id: string; title: string; desc: string; unit: string }
  | { kind: "custom"; metric: CustomMetric };

type Item = { label: string; sub?: string; value: number };

export function DeepDive({ source, onClose }: { source: DiveSource; onClose: () => void }) {
  const { plays, scope, years, deep } = useData();
  const refine = useRefine();
  const [entity, setEntity] = useState<EntityRef | null>(null);
  const [full, setFull] = useState<MetricOutput | null>(null);
  const [yearly, setYearly] = useState<{ year: number; out: MetricOutput | null }[]>([]);
  const idx = useMemo(() => buildIndex(plays), [plays]);

  const meta =
    source.kind === "deep"
      ? { title: source.title, desc: source.desc, unit: source.unit, code: undefined as string | undefined }
      : { title: source.metric.title, desc: source.metric.description, unit: source.metric.unit, code: source.metric.code };

  // Close on Escape; stop the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (entity ? setEntity(null) : onClose());
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [entity, onClose]);

  // Full ranking for the current period, then year-by-year, computed progressively.
  useEffect(() => {
    let alive = true;
    const run = async (s: number | "all"): Promise<MetricOutput | null> => {
      if (source.kind === "deep") return s === scope ? runOne(plays, s, source.id, 30) : (deep(s).find((r) => r.m.id === source.id)?.out ?? null);
      try {
        return await sandbox().run(plays, s, source.metric.code);
      } catch {
        return null;
      }
    };
    (async () => {
      setFull(null);
      setYearly([]);
      await new Promise((r) => setTimeout(r, 0));
      const f = await run(scope);
      if (!alive) return;
      setFull(f);
      const acc: { year: number; out: MetricOutput | null }[] = [];
      for (const y of years) {
        await new Promise((r) => setTimeout(r, 0));
        if (!alive) return;
        acc.push({ year: y, out: await run(y) });
        setYearly([...acc]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source, scope, plays, years, deep]);

  const open = (it: Item) => {
    const ref = resolve(idx, it.label, it.sub);
    if (ref) setEntity(ref);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={meta.title}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-ink-2 p-5 shadow-2xl sm:rounded-[2rem] sm:p-8"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold hover:bg-white/20">
          ✕
        </button>

        {entity ? (
          <EntityView refx={entity} back={meta.title} onBack={() => setEntity(null)} onOpen={setEntity} onAsk={(prompt) => refine({ prompt })} />
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime">Deep dive · {scope === "all" ? "All time" : scope}</p>
            <h2 className="font-display mt-2 pr-10 text-4xl font-extrabold sm:text-5xl">{meta.title}</h2>
            <p className="mt-2 text-cream/65">{meta.desc}</p>

            <section className="mt-7">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-cream/50">
                {full?.viz === "list" ? "The full ranking" : "This period"}
                {full?.viz === "list" && <span className="ml-2 normal-case tracking-normal text-cream/40">Tap any row for its profile</span>}
              </h3>
              {full ? <MetricView out={full} unit={meta.unit} limit={30} onItem={open} /> : <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}
            </section>

            {years.length > 1 && (
              <section className="mt-9">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-cream/50">Year by year</h3>
                <YearByYear rows={yearly} unit={meta.unit} total={years.length} onItem={open} />
              </section>
            )}

            <div className="mt-9 rounded-2xl bg-pink/10 p-5">
              <p className="font-display text-2xl font-extrabold">Want a sharper version?</p>
              <p className="mt-1 text-sm text-cream/70">Narrow it down, add a condition, or combine it with something else. The AI can also suggest more advanced versions.</p>
              <button
                onClick={() => refine({ title: meta.title, description: meta.desc, unit: meta.unit, code: meta.code })}
                className="mt-4 rounded-full bg-pink px-5 py-2.5 font-bold text-ink transition hover:scale-105"
              >
                Refine with AI ✦
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function YearByYear({ rows, unit, total, onItem }: { rows: { year: number; out: MetricOutput | null }[]; unit: string; total: number; onItem: (i: Item) => void }) {
  if (!rows.length) return <div className="h-24 animate-pulse rounded-2xl bg-white/5" />;
  const nums = rows.every((r) => !r.out || (r.out.viz === "number" && typeof r.out.value === "number"));
  if (nums) {
    return (
      <VBars
        items={rows.map((r) => ({ label: String(r.year), value: r.out && r.out.viz === "number" ? Number(r.out.value) : 0 }))}
        color="#ff4fb8"
        format={(v) => `${v}${unit === "%" ? "%" : unit ? " " + unit : ""}`}
      />
    );
  }
  return (
    <div className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.03]">
      {rows.map(({ year, out }) => {
        let top: Item | null = null;
        let text = "Not enough data";
        if (out?.viz === "number") text = `${out.value}${typeof out.value === "number" && unit ? (unit === "%" ? "%" : " " + unit) : ""}`;
        else if (out && out.items.length) {
          top = out.viz === "list" ? out.items[0] : [...out.items].sort((a, b) => b.value - a.value)[0];
          text = `${out.viz === "list" ? "" : "Peak: "}${top.label}`;
        }
        return (
          <button
            key={year}
            disabled={!top || out?.viz !== "list"}
            onClick={() => top && onItem(top)}
            className="flex w-full items-center gap-4 px-4 py-3 text-left transition enabled:hover:bg-white/[0.05]"
          >
            <span className="font-display w-14 shrink-0 text-xl font-extrabold text-lime">{year}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-semibold ${top ? "" : "text-cream/40"}`}>{text}</span>
              {top?.sub && <span className="block truncate text-xs text-cream/50">{top.sub}</span>}
            </span>
            {top && <span className="shrink-0 text-sm tabular-nums text-cream/70">{top.value.toLocaleString()}{unit === "%" ? "%" : unit ? ` ${unit}` : ""}</span>}
          </button>
        );
      })}
      {rows.length < total && <div className="px-4 py-3 text-xs text-cream/40">Working through the rest of your years…</div>}
    </div>
  );
}

function EntityView({ refx, back, onBack, onOpen, onAsk }: { refx: EntityRef; back: string; onBack: () => void; onOpen: (r: EntityRef) => void; onAsk: (prompt: string) => void }) {
  const { plays, scope } = useData();
  const p = useMemo(() => profile(plays, scope, refx), [plays, scope, refx]);
  const idx = useMemo(() => buildIndex(plays), [plays]);
  const tiles: [string, string][] = [
    ["Plays", fmtInt(p.plays)],
    ["Minutes", fmtInt(p.minutes)],
    ["Picked by you", `${p.pickedPct}%`],
    ["Skipped", `${p.skippedPct}%`],
    ["Finished", `${p.finishedPct}%`],
    ["Of your listening", `${(p.share * 100).toFixed(1)}%`],
    ["First heard", p.first ? fmtDay(p.first, true) : "—"],
    ["Last played", p.last ? fmtDay(p.last, true) : "—"],
  ];
  const what = refx.kind === "song" ? `the song “${refx.track}” by ${refx.artist}` : refx.kind === "artist" ? `the artist ${refx.artist}` : `the album “${refx.album}” by ${refx.artist}`;
  return (
    <div>
      <button onClick={onBack} className="text-sm font-bold text-cream/60 hover:text-cream">
        ← {back}
      </button>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-lime">
        {refx.kind} · {scope === "all" ? "All time" : scope}
      </p>
      <h2 className="font-display mt-2 pr-10 text-4xl font-extrabold [overflow-wrap:anywhere] sm:text-5xl">{p.title}</h2>
      <p className="mt-1 text-cream/60">{p.subtitle}</p>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cream/50">{l}</p>
            <p className="font-display mt-1 text-2xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>

      {p.monthly.length > 1 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-cream/50">Plays per month, whole history</h3>
          <Line items={p.monthly} color="#d4ff3a" height={150} />
        </section>
      )}

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-cream/50">When you play it</h3>
        <VBars items={p.hours} color="#8fd8ff" height={110} format={(v) => `${v} plays`} />
      </section>

      {p.topSongs.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-cream/50">Top songs</h3>
          <HBars
            items={p.topSongs}
            color="bg-violet"
            format={(v) => `${v} plays`}
            onItem={(it) => {
              const r = resolve(idx, it.label, it.sub);
              if (r) onOpen(r);
            }}
          />
        </section>
      )}

      <div className="mt-9 rounded-2xl bg-pink/10 p-5">
        <p className="font-display text-2xl font-extrabold">Ask anything about it</p>
        <p className="mt-1 text-sm text-cream/70">For example: how your relationship with it changed, what you play right before or after it, or when you play it.</p>
        <button onClick={() => onAsk(`About ${what}: `)} className="mt-4 rounded-full bg-pink px-5 py-2.5 font-bold text-ink transition hover:scale-105">
          Build a metric about it ✦
        </button>
      </div>
    </div>
  );
}
