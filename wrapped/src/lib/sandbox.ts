import type { LPlay, Scope } from "./types";

/**
 * Runs AI-written metric code inside a dedicated Web Worker:
 *  - no access to the page, DOM, cookies or localStorage
 *  - network APIs are disabled inside the worker before user code runs
 *  - hard timeout; a runaway worker is terminated and replaced
 */

export type MetricViz = "number" | "list" | "bars" | "line";

export type MetricOutput =
  | { viz: "number"; value: number | string; caption?: string }
  | { viz: "list"; items: { label: string; sub?: string; value: number }[] }
  | { viz: "bars" | "line"; items: { label: string; value: number }[] };

const WORKER_SRC = `
"use strict";
// Lock down network access for generated code.
{
  const blocked = ["fetch","XMLHttpRequest","WebSocket","WebTransport","EventSource","importScripts","indexedDB","caches","BroadcastChannel","Worker","SharedWorker","navigator"];
  for (let o = self; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of blocked) {
      try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (e) {}
    }
  }
}
let ALL = [];
const QUALIFY_MS = 30000;
const H = {
  QUALIFY_MS,
  minutes: (ms) => ms / 60000,
  hours: (ms) => ms / 3600000,
  isMusic: (p) => p.kind === "track" && !!p.track && !!p.artist,
  isSkip: (p) => p.skipped || (p.reasonEnd === "fwdbtn" && p.ms < QUALIFY_MS),
  isIntentional: (p) => p.reasonStart === "clickrow" || p.reasonStart === "playbtn" || p.reasonStart === "backbtn",
  isStream: (p) => p.ms >= QUALIFY_MS,
  trackKey: (p) => p.uri || (p.track + " — " + p.artist),
  groupBy: (arr, fn) => { const m = new Map(); for (const x of arr) { const k = fn(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); } return m; },
  sumBy: (arr, fn) => { let s = 0; for (const x of arr) s += fn(x) || 0; return s; },
  countBy: (arr, fn) => { const m = new Map(); for (const x of arr) { const k = fn(x); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count); },
  topN: (arr, n, score) => [...arr].sort((a, b) => score(b) - score(a)).slice(0, n),
  mean: (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
  median: (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
};
self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "load") { ALL = msg.plays; self.postMessage({ id: msg.id, ok: true }); return; }
  if (msg.type === "run") {
    try {
      const plays = msg.scope === "all" ? ALL : ALL.filter((p) => p.year === msg.scope);
      const ctx = { scope: msg.scope, allPlays: ALL, helpers: H, years: [...new Set(ALL.map((p) => p.year))].sort() };
      const fn = new Function("plays", "ctx", "helpers", '"use strict";\\n' + msg.code);
      const out = fn(plays, ctx, H);
      self.postMessage({ id: msg.id, ok: true, out: JSON.parse(JSON.stringify(out ?? null)) });
    } catch (err) {
      self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
    }
  }
};
`;

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

class Sandbox {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private loaded: LPlay[] | null = null;
  private loading: Promise<unknown> | null = null;

  private spawn() {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.out);
      else p.reject(new Error(e.data.error));
    };
    this.worker = w;
    this.loaded = null;
    this.loading = null;
  }

  private call(msg: Record<string, unknown>, timeoutMs: number) {
    if (!this.worker) this.spawn();
    const id = ++this.seq;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker?.terminate();
        this.worker = null;
        reject(new Error(`Timed out after ${timeoutMs / 1000}s — the metric is too slow (try a simpler approach).`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  async run(plays: LPlay[], scope: Scope, code: string): Promise<MetricOutput> {
    if (!this.worker) this.spawn();
    if (this.loaded !== plays) {
      this.loaded = plays;
      this.loading = this.call({ type: "load", plays }, 30_000);
    }
    await this.loading;
    const raw = await this.call({ type: "run", scope, code }, 8_000);
    return normalize(raw);
  }
}

let instance: Sandbox | null = null;
export function sandbox() {
  if (!instance) instance = new Sandbox();
  return instance;
}

/** Validate & coerce whatever the generated code returned. */
export function normalize(raw: unknown): MetricOutput {
  if (raw === null || raw === undefined) throw new Error("The metric returned nothing.");
  if (typeof raw === "number" || typeof raw === "string") return { viz: "number", value: raw };
  const o = raw as Record<string, unknown>;
  const viz = o.viz as MetricViz | undefined;
  if (viz === "number" || ("value" in o && !("items" in o))) {
    const v = o.value;
    if (typeof v !== "number" && typeof v !== "string") throw new Error("A 'number' metric must return { value }.");
    return { viz: "number", value: typeof v === "number" && !Number.isFinite(v) ? "—" : v, caption: typeof o.caption === "string" ? o.caption : undefined };
  }
  if (!Array.isArray(o.items)) throw new Error("Expected { items: [...] } in the result.");
  const items = (o.items as Record<string, unknown>[]).slice(0, 50).map((it) => ({
    label: String(it?.label ?? "—"),
    sub: it?.sub == null ? undefined : String(it.sub),
    value: Number(it?.value) || 0,
  }));
  if (viz === "bars" || viz === "line") return { viz, items };
  return { viz: "list", items };
}
