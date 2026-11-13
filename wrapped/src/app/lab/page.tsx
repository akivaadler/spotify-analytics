"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useData, type CustomMetric } from "@/lib/data-context";
import { Nav, ScopePicker, Starburst } from "@/components/ui";
import { Uploader } from "@/components/Uploader";
import { MetricView } from "@/components/MetricView";
import { sandbox, type MetricOutput, type MetricViz } from "@/lib/sandbox";
import { readLS, writeLS } from "@/lib/storage";

const EXAMPLES = [
  "Which artists do I play most on Sundays?",
  "My most-played song in each month",
  "Songs I always finish: 10+ plays and never skipped",
  "Average minutes per day, by day of week",
  "How many new artists I discovered each month",
  "The album I've played the most different songs from",
  "What share of my listening is songs from the last 90 days of discoveries?",
  "Longest gap between two plays of my #1 song",
];

interface Draft {
  id: string;
  prompt: string;
  title: string;
  description: string;
  viz: MetricViz;
  unit: string;
  code: string;
}

export default function Lab() {
  const { status, plays, scope, metrics, saveMetric, deleteMetric } = useData();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [out, setOut] = useState<MetricOutput | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [userKey, setUserKey] = useState("");

  useEffect(() => setUserKey(readLS("encore.apiKey", "")), []);

  // ?edit=<id> opens a saved metric
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    const m = id && metrics.find((x) => x.id === id);
    if (m) {
      setDraft({ ...m });
      setPrompt(m.prompt);
      setShowCode(true);
    }
  }, [metrics]);

  // Re-run preview whenever the code or the period changes.
  useEffect(() => {
    if (!draft || status !== "ready") return;
    let alive = true;
    setOut(null);
    setRunErr(null);
    sandbox()
      .run(plays, scope, draft.code)
      .then((o) => alive && setOut(o))
      .catch((e: Error) => alive && setRunErr(e.message));
    return () => {
      alive = false;
    };
  }, [draft?.code, plays, scope, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(p: string, repair?: { code: string; error: string }) {
    if (!p.trim()) return;
    setApiErr(null);
    setBusy(repair ? "Fixing the metric…" : "Writing your metric…");
    try {
      const res = await fetch("/api/metric", {
        method: "POST",
        headers: { "content-type": "application/json", ...(userKey ? { "x-anthropic-key": userKey } : {}) },
        body: JSON.stringify({ prompt: p, previousCode: repair?.code, error: repair?.error }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "no_key") {
          setKeyOpen(true);
          setApiErr(data.message ?? "An Anthropic API key is needed.");
        } else setApiErr(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const d: Draft = { id: draft?.id ?? crypto.randomUUID(), prompt: p, title: data.title, description: data.description, viz: data.viz, unit: data.unit ?? "", code: data.code };
      setDraft(d);
      // Try it once locally; if it fails, ask the model to repair it automatically (one attempt).
      if (!repair) {
        try {
          await sandbox().run(plays, scope, d.code);
        } catch (e) {
          setBusy(null);
          return generate(p, { code: d.code, error: (e as Error).message });
        }
      }
    } catch {
      setApiErr("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function save() {
    if (!draft) return;
    const m: CustomMetric = { ...draft, createdAt: metrics.find((x) => x.id === draft.id)?.createdAt ?? Date.now() };
    saveMetric(m);
    router.push("/dashboard");
  }

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

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Nav />
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <Starburst className="pointer-events-none absolute -right-16 -top-12 w-32 animate-spin-slow opacity-60 sm:-right-20 sm:-top-10 sm:w-56 sm:opacity-80" color="#6b3bff" />
        <h1 className="font-display relative text-6xl font-extrabold sm:text-8xl">
          Metric <span className="text-pink">Lab.</span>
        </h1>
        <p className="relative mt-4 max-w-2xl text-lg text-cream/75">
          Describe any stat you want. AI writes the code, it runs on your data here in your browser, and you can add the result to your dashboard and story.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
          {/* composer */}
          <section className="rounded-[2rem] bg-violet p-6 sm:p-8">
            <label htmlFor="prompt" className="font-display text-3xl font-extrabold">
              What do you want to know?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && generate(prompt)}
              rows={4}
              placeholder="e.g. Which song did I play most on rainy-day hours (2pm–6pm) in winter?"
              className="mt-4 w-full resize-none rounded-2xl bg-ink/40 p-4 text-lg text-cream placeholder:text-cream/45 focus:outline-none focus:ring-2 focus:ring-lime"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((e, i) => (
                <button key={e} onClick={() => setPrompt(e)} className={`rounded-full bg-cream/15 px-3 py-1.5 text-left text-xs font-semibold transition hover:bg-cream/25 ${i >= 4 ? "hidden sm:inline-block" : ""}`}>
                  {e}
                </button>
              ))}
            </div>
            <button
              onClick={() => generate(prompt)}
              disabled={!!busy || !prompt.trim()}
              className="mt-6 w-full rounded-full bg-lime px-6 py-4 font-display text-2xl font-extrabold text-ink transition enabled:hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ?? "Build it ✦"}
            </button>
            {apiErr && <p className="mt-3 rounded-xl bg-ink/40 p-3 text-sm text-yellow">{apiErr}</p>}

            <div className="mt-6 border-t border-cream/15 pt-4 text-sm">
              <button onClick={() => setKeyOpen((v) => !v)} className="font-semibold text-cream/80 hover:text-cream">
                {keyOpen ? "▾" : "▸"} AI settings & privacy
              </button>
              {keyOpen && (
                <div className="mt-3 space-y-3 text-cream/80">
                  <p>
                    Only your question and a description of the data fields are sent to the AI. <b>Your listening history never leaves this browser.</b> The code that comes back runs in an isolated worker with network access turned off.
                  </p>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider">Your Anthropic API key (optional)</span>
                    <input
                      type="password"
                      value={userKey}
                      onChange={(e) => {
                        setUserKey(e.target.value);
                        writeLS("encore.apiKey", e.target.value);
                      }}
                      placeholder="sk-ant-…"
                      className="mt-1 w-full rounded-xl bg-ink/40 px-3 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-lime"
                    />
                    <span className="mt-1 block text-xs text-cream/60">Only needed if this site doesn&apos;t provide one. It&apos;s stored in this browser and sent only with Lab requests.</span>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* preview */}
          <section className="rounded-[2rem] bg-ink-2 p-6 sm:p-8">
            <div className="mb-4 flex flex-col gap-3">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cream/55">Preview</p>
              <div className="min-w-0">
                <ScopePicker />
              </div>
            </div>
            {!draft ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 p-8 text-center text-cream/50">
                {busy ? <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink border-t-transparent" /> : "Your metric will appear here."}
              </div>
            ) : (
              <div>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="font-display w-full bg-transparent text-3xl font-extrabold focus:outline-none"
                />
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="mt-1 w-full bg-transparent text-sm text-cream/60 focus:outline-none"
                />
                <div className="mt-6 min-h-32">
                  {runErr ? (
                    <div className="rounded-xl bg-red/10 p-4 text-sm text-red">
                      <p className="font-bold">The metric hit an error</p>
                      <p className="mt-1 font-mono text-xs">{runErr}</p>
                      <button onClick={() => generate(draft.prompt, { code: draft.code, error: runErr })} className="mt-3 rounded-full bg-red px-4 py-1.5 font-bold text-ink" disabled={!!busy}>
                        Ask AI to fix it
                      </button>
                    </div>
                  ) : out ? (
                    <MetricView out={out} unit={draft.unit} />
                  ) : (
                    <div className="h-32 animate-pulse rounded-xl bg-white/5" />
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button onClick={save} disabled={!!runErr || !out} className="rounded-full bg-pink px-5 py-2.5 font-bold text-ink transition enabled:hover:scale-105 disabled:opacity-40">
                    {metrics.some((m) => m.id === draft.id) ? "Save changes" : "Add to dashboard"}
                  </button>
                  <button onClick={() => setShowCode((v) => !v)} className="rounded-full border border-white/20 px-5 py-2.5 font-bold text-cream/80">
                    {showCode ? "Hide code" : "View / edit code"}
                  </button>
                  <button
                    onClick={() => {
                      setDraft(null);
                      setOut(null);
                      setRunErr(null);
                      setPrompt("");
                      window.history.replaceState(null, "", "/lab");
                    }}
                    className="rounded-full px-4 py-2.5 font-bold text-cream/50 hover:text-cream"
                  >
                    Start over
                  </button>
                </div>
                {showCode && <CodeEditor key={draft.id + draft.code.length} code={draft.code} viz={draft.viz} onRun={(code) => setDraft({ ...draft, code })} />}
              </div>
            )}
          </section>
        </div>

        {metrics.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl font-extrabold">Saved metrics</h2>
            <ul className="mt-4 divide-y divide-white/10 rounded-[1.5rem] bg-ink-2">
              {metrics.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.title}</p>
                    <p className="truncate text-sm text-cream/50">“{m.prompt}”</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setDraft({ ...m });
                        setPrompt(m.prompt);
                        setShowCode(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-full px-3 py-1 text-sm font-bold text-cream/70 hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button onClick={() => deleteMetric(m.id)} className="rounded-full px-3 py-1 text-sm font-bold text-cream/70 hover:bg-red/20 hover:text-red">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function CodeEditor({ code, viz, onRun }: { code: string; viz: MetricViz; onRun: (c: string) => void }) {
  const [text, setText] = useState(code);
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs text-cream/50">
        <code>function (plays, ctx, helpers) {"{"} … {"}"}</code> · returns a <b>{viz}</b> result
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={14}
        className="w-full rounded-2xl bg-ink p-4 font-mono text-xs leading-relaxed text-mint focus:outline-none focus:ring-2 focus:ring-lime"
      />
      <button onClick={() => onRun(text)} className="mt-2 rounded-full bg-cream px-4 py-1.5 text-sm font-bold text-ink">
        Run edited code
      </button>
    </div>
  );
}
