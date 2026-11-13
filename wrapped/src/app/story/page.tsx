"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, type CustomMetric } from "@/lib/data-context";
import { buildSlides, StoryPlayer } from "@/components/Story";
import { sandbox, type MetricOutput } from "@/lib/sandbox";
import { Nav, ScopePicker, Wordmark } from "@/components/ui";
import { Uploader } from "@/components/Uploader";

export default function StoryPage() {
  const { status, scope, report, plays, metrics } = useData();
  const router = useRouter();
  const [custom, setCustom] = useState<{ m: CustomMetric; out: MetricOutput }[]>([]);
  const [started, setStarted] = useState(false);

  // Run saved custom metrics so they appear as slides too.
  useEffect(() => {
    if (status !== "ready" || !metrics.length) return setCustom([]);
    let alive = true;
    (async () => {
      const res: { m: CustomMetric; out: MetricOutput }[] = [];
      for (const m of metrics) {
        try {
          res.push({ m, out: await sandbox().run(plays, scope, m.code) });
        } catch {
          /* skip broken metrics in the story */
        }
      }
      if (alive) setCustom(res);
    })();
    return () => {
      alive = false;
    };
  }, [status, metrics, plays, scope]);

  const r = useMemo(() => (status === "ready" ? report(scope) : null), [status, report, scope]);
  const slides = useMemo(() => (r ? buildSlides(r, custom) : []), [r, custom]);

  if (status === "loading") return <div className="min-h-dvh" />;
  if (status === "empty")
    return (
      <div className="min-h-dvh">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-display mb-8 text-5xl font-extrabold">First, your data.</h1>
          <Uploader />
        </main>
      </div>
    );

  if (!started) {
    return (
      <div className="min-h-dvh">
        <Nav />
        <main className="mx-auto flex max-w-3xl flex-col items-start px-4 py-16 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cream/60">Pick a year</p>
          <div className="mt-4 w-full">
            <ScopePicker />
          </div>
          <button
            onClick={() => setStarted(true)}
            className="group mt-10 w-full overflow-hidden rounded-[2rem] bg-lime p-8 text-left text-ink transition hover:-rotate-1 sm:p-12"
          >
            <Wordmark className="text-ink" dot="text-pink" />
            <p className="font-display mt-6 text-7xl font-extrabold sm:text-9xl">{scope === "all" ? "All time" : scope}</p>
            <p className="font-display mt-2 text-3xl font-extrabold">Start ▶</p>
            <p className="mt-3 text-sm font-semibold opacity-75">
              {slides.length} slides{custom.length ? `, including ${custom.length} of your own metric${custom.length > 1 ? "s" : ""}` : ""}
            </p>
          </button>
        </main>
      </div>
    );
  }

  return <StoryPlayer key={String(scope)} slides={slides} onClose={() => router.push("/dashboard")} />;
}
