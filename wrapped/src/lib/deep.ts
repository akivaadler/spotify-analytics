/**
 * "Deep cuts" — 50 behavioural metrics built from the signals Spotify's export
 * actually contains: how each play STARTED (you picked it vs. autoplay), how it
 * ENDED (finished, skipped, stopped), shuffle / offline / device / country, and
 * each song's whole life across your history.
 *
 * Everything is computed from one pass that builds per-song, per-artist and
 * per-session profiles; each metric then reads from that shared context.
 */
import type { LPlay, Scope } from "./types";
import type { MetricOutput } from "./sandbox";
import { DOWS, MONTHS, deviceFamily, fmtDay, fmtHour, isSkip, trackKey } from "./analytics";

const DAY = 86_400_000;
const STREAM = 30_000;

/* ───────────── signal definitions ───────────── */

/** You chose this play: tapped the song, pressed play, or went back to it. */
export const isActive = (p: LPlay) => p.reasonStart === "clickrow" || p.reasonStart === "playbtn" || p.reasonStart === "backbtn";
/** It arrived on its own: the previous track ended and this one rolled on. */
const isPassive = (p: LPlay) => p.reasonStart === "trackdone";
const isFull = (p: LPlay) => p.reasonEnd === "trackdone";
const isMusic = (p: LPlay) => p.kind === "track" && !!p.track && !!p.artist && p.ms > 0;
const mIdx = (p: LPlay) => p.year * 12 + p.month - 1;

export type DeepCat = "choice" | "skips" | "lifecycle" | "depth" | "rituals" | "context";
export const DEEP_CATS: { id: DeepCat; label: string; blurb: string; color: string }[] = [
  { id: "choice", label: "Choice", blurb: "What you pick vs. what autoplay picks for you", color: "bg-lime" },
  { id: "skips", label: "Skips", blurb: "Rejection, patience and burnout", color: "bg-orange" },
  { id: "lifecycle", label: "Lifecycle", blurb: "How songs and artists enter, peak and fade", color: "bg-violet" },
  { id: "depth", label: "Depth", blurb: "Repeats, albums and how deep you go", color: "bg-pink" },
  { id: "rituals", label: "Rituals", blurb: "Songs tied to times, days and seasons", color: "bg-sky" },
  { id: "context", label: "Context", blurb: "Devices, travel, offline and shuffle", color: "bg-mint" },
];

/* ───────────── shared context ───────────── */

interface TrackStat {
  key: string;
  track: string;
  artist: string;
  album: string | null;
  events: number; // every play attempt in scope
  plays: number; // streams (>= 30s) in scope
  active: number;
  back: number;
  passive: number;
  skips: number;
  skipSecs: number[];
  full: number;
  offline: number;
  shuffleWin: number;
  seq: { skip: boolean; full: boolean }[];
  ts: number[]; // stream timestamps in scope
  hours: number[];
  weekend: number;
  commute: number;
  summer: number;
  days: Set<number>;
  monthsInScope: Set<number>;
}

interface Hist {
  ts: number[]; // stream timestamps, all history
  mi: number[]; // month index for each stream
  first: number; // first event of any length
  firstStart: string;
  track: string;
  artist: string;
}

export interface DeepCtx {
  scope: Scope;
  scoped: LPlay[]; // every play in scope (music + podcasts), ordered
  music: LPlay[]; // music in scope, ordered
  tracks: Map<string, TrackStat>;
  hist: Map<string, Hist>;
  artistFirst: Map<string, { ts: number; track: string }>;
  artistMonths: Map<string, Set<number>>;
  sessions: LPlay[][];
  scopeStart: number;
  scopeEnd: number;
  scopeEndMi: number;
  minP: number;
  monthKey: (p: LPlay) => number;
  monthName: (k: number) => string;
}

function buildCtx(all: LPlay[], scope: Scope): DeepCtx {
  const inS = (p: LPlay) => scope === "all" || p.year === scope;
  const scoped = all.filter((p) => inS(p) && p.ms > 0);
  const music = scoped.filter(isMusic);
  const scopeStart = scoped.length ? scoped[0].ts : 0;
  const scopeEnd = scoped.length ? scoped[scoped.length - 1].ts : 0;
  const scopeEndMi = scoped.length ? mIdx(scoped[scoped.length - 1]) : 0;

  // full-history profiles
  const hist = new Map<string, Hist>();
  const artistFirst = new Map<string, { ts: number; track: string }>();
  const artistMonths = new Map<string, Set<number>>();
  for (const p of all) {
    if (!isMusic(p)) continue;
    const k = trackKey(p);
    let h = hist.get(k);
    if (!h) hist.set(k, (h = { ts: [], mi: [], first: p.ts, firstStart: p.reasonStart, track: p.track!, artist: p.artist! }));
    if (p.ms >= STREAM) {
      h.ts.push(p.ts);
      h.mi.push(mIdx(p));
      if (!artistFirst.has(p.artist!)) artistFirst.set(p.artist!, { ts: p.ts, track: p.track! });
      (artistMonths.get(p.artist!) ?? artistMonths.set(p.artist!, new Set()).get(p.artist!)!).add(mIdx(p));
    }
  }

  // scope profiles
  const tracks = new Map<string, TrackStat>();
  for (const p of music) {
    const k = trackKey(p);
    let t = tracks.get(k);
    if (!t)
      tracks.set(
        k,
        (t = {
          key: k, track: p.track!, artist: p.artist!, album: p.album,
          events: 0, plays: 0, active: 0, back: 0, passive: 0, skips: 0, skipSecs: [], full: 0, offline: 0, shuffleWin: 0,
          seq: [], ts: [], hours: new Array(24).fill(0), weekend: 0, commute: 0, summer: 0, days: new Set(), monthsInScope: new Set(),
        }),
      );
    t.events++;
    const sk = isSkip(p);
    const fu = isFull(p);
    t.seq.push({ skip: sk, full: fu });
    if (isActive(p)) t.active++;
    if (p.reasonStart === "backbtn") t.back++;
    if (isPassive(p)) t.passive++;
    if (sk) (t.skips++, t.skipSecs.push(p.ms / 1000));
    if (fu) t.full++;
    if (p.ms >= STREAM) {
      t.plays++;
      t.ts.push(p.ts);
      t.hours[p.hour]++;
      if (p.dow >= 5) t.weekend++;
      if (p.dow < 5 && ((p.hour >= 7 && p.hour <= 8) || (p.hour >= 16 && p.hour <= 18))) t.commute++;
      if (p.month >= 6 && p.month <= 8) t.summer++;
      if (p.offline) t.offline++;
      if (p.shuffle && p.reasonStart === "trackdone" && fu) t.shuffleWin++;
      t.days.add(p.dayIndex);
      t.monthsInScope.add(mIdx(p));
    }
  }

  // sessions (30 min silence ends one), music only
  const sessions: LPlay[][] = [];
  let cur: LPlay[] = [];
  let end = -Infinity;
  for (const p of music) {
    const start = p.ts - p.ms;
    if (cur.length && start - end > 30 * 60_000) (sessions.push(cur), (cur = []));
    cur.push(p);
    end = Math.max(end, p.ts);
  }
  if (cur.length) sessions.push(cur);

  const streams = music.filter((p) => p.ms >= STREAM).length;
  const minP = Math.max(5, Math.min(25, Math.round(streams / 900)));
  const monthKey = (p: LPlay) => (scope === "all" ? p.year * 100 + p.month : p.month);
  const monthName = (k: number) => (k > 100 ? `${MONTHS[(k % 100) - 1]} '${String(Math.floor(k / 100)).slice(2)}` : MONTHS[k - 1]);
  return { scope, scoped, music, tracks, hist, artistFirst, artistMonths, sessions, scopeStart, scopeEnd, scopeEndMi, minP, monthKey, monthName };
}

/* ───────────── helpers ───────────── */

type Out = MetricOutput | null;
const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b ? r1((a / b) * 100) : 0);
const T = (c: DeepCtx) => [...c.tracks.values()];
/** How many rows ranked lists return. Raised temporarily for deep dives. */
let LIMIT = 10;
function list<X>(rows: X[], score: (x: X) => number, label: (x: X) => string, sub: (x: X) => string, n = LIMIT): Out {
  const items = rows
    .map((x) => ({ x, v: score(x) }))
    .filter((r) => Number.isFinite(r.v) && r.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map(({ x, v }) => ({ label: label(x), sub: sub(x), value: r1(v) }));
  return items.length ? { viz: "list", items } : null;
}
function listAsc<X>(rows: X[], score: (x: X) => number, label: (x: X) => string, sub: (x: X) => string, n = LIMIT): Out {
  const items = rows
    .map((x) => ({ x, v: score(x) }))
    .filter((r) => Number.isFinite(r.v))
    .sort((a, b) => a.v - b.v)
    .slice(0, n)
    .map(({ x, v }) => ({ label: label(x), sub: sub(x), value: r1(v) }));
  return items.length ? { viz: "list", items } : null;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function byMonth(c: DeepCtx, fn: (ps: LPlay[]) => number | null, minN = 30): Out {
  const g = new Map<number, LPlay[]>();
  for (const p of c.music) (g.get(c.monthKey(p)) ?? g.set(c.monthKey(p), []).get(c.monthKey(p))!).push(p);
  const items = [...g.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, ps]) => ps.length >= minN)
    .map(([k, ps]) => ({ label: c.monthName(k), value: fn(ps) }))
    .filter((x): x is { label: string; value: number } => x.value !== null)
    .map((x) => ({ ...x, value: r1(x.value) }));
  return items.length >= 3 ? { viz: "line", items } : null;
}
function aggregate<K>(c: DeepCtx, key: (t: TrackStat) => K | null) {
  const m = new Map<K, TrackStat[]>();
  for (const t of c.tracks.values()) {
    const k = key(t);
    if (k === null) continue;
    (m.get(k) ?? m.set(k, []).get(k)!).push(t);
  }
  return m;
}
const sum = <X,>(xs: X[], f: (x: X) => number) => xs.reduce((s, x) => s + f(x), 0);
const histUpTo = (c: DeepCtx, k: string) => {
  const h = c.hist.get(k);
  if (!h) return null;
  let n = h.ts.length;
  while (n > 0 && h.ts[n - 1] > c.scopeEnd) n--;
  return { ...h, ts: h.ts.slice(0, n), mi: h.mi.slice(0, n) };
};

/* ───────────── the 50 metrics ───────────── */

export interface DeepMetric {
  id: string;
  cat: DeepCat;
  title: string;
  desc: string;
  unit: string;
  story?: string; // kicker if featured in the story
  run: (c: DeepCtx) => Out;
}

export const DEEP_METRICS: DeepMetric[] = [
  /* ── CHOICE ── */
  {
    id: "chosen-songs", cat: "choice", unit: "picks", story: "Most actively chosen song",
    title: "Most actively chosen songs",
    desc: "Not most played. These are the songs you tapped, pressed play on, or went back to, rather than ones autoplay served.",
    run: (c) => list(T(c), (t) => t.active, (t) => t.track, (t) => `${t.artist} · ${pct(t.active, t.events)}% of its plays were your pick`),
  },
  {
    id: "chosen-albums", cat: "choice", unit: "picks",
    title: "Most actively chosen albums",
    desc: "Albums ranked by how often you deliberately started one of their songs.",
    run: (c) => {
      const g = aggregate(c, (t) => (t.album ? `${t.album}␟${t.artist}` : null));
      return list([...g.values()], (ts) => sum(ts, (t) => t.active), (ts) => ts[0].album!, (ts) => `${ts[0].artist} · ${new Set(ts.filter((t) => t.active).map((t) => t.key)).size} songs picked`);
    },
  },
  {
    id: "chosen-artists", cat: "choice", unit: "picks",
    title: "Most actively chosen artists",
    desc: "Who you go looking for, as opposed to who just shows up.",
    run: (c) => {
      const g = aggregate(c, (t) => t.artist);
      return list([...g.entries()], ([, ts]) => sum(ts, (t) => t.active), ([a]) => a, ([, ts]) => `${pct(sum(ts, (t) => t.active), sum(ts, (t) => t.events))}% of their plays were your pick`);
    },
  },
  {
    id: "hand-picked", cat: "choice", unit: "%",
    title: "Hand-picked only",
    desc: "Songs you almost always start yourself. Autoplay rarely gets to play them for you.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => (t.active / t.events) * 100 + t.plays / 1e4, (t) => t.track, (t) => `${t.artist} · ${t.active} of ${t.events} plays picked`),
  },
  {
    id: "autopilot", cat: "choice", unit: "%",
    title: "Autopilot favourites",
    desc: "Songs you play a lot but almost never choose. They reach you through albums, playlists and autoplay.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP && t.active / t.events < 0.15), (t) => (t.passive / t.events) * 100, (t) => t.track, (t) => `${t.artist} · ${t.plays} plays, only ${t.active} picked`),
  },
  {
    id: "rewind", cat: "choice", unit: "rewinds",
    title: "Rewind magnets",
    desc: "Songs you hit the back button to hear again. That's about the strongest compliment there is.",
    run: (c) => list(T(c), (t) => t.back, (t) => t.track, (t) => t.artist),
  },
  {
    id: "openers", cat: "choice", unit: "sessions",
    title: "Session starters",
    desc: "The songs you deliberately pick as the very first thing you play when you start listening.",
    run: (c) => {
      const m = new Map<string, { p: LPlay; n: number }>();
      for (const s of c.sessions) {
        const p = s[0];
        if (!isActive(p)) continue;
        const k = trackKey(p);
        const v = m.get(k) ?? { p, n: 0 };
        v.n++;
        m.set(k, v);
      }
      return list([...m.values()], (v) => v.n, (v) => v.p.track!, (v) => v.p.artist!);
    },
  },
  {
    id: "control-hour", cat: "choice", unit: "%",
    title: "When you're in control",
    desc: "Share of songs you picked yourself, by hour of day. Lower bars are the hours you let the music run.",
    run: (c) => {
      const a = new Array(24).fill(0);
      const n = new Array(24).fill(0);
      for (const p of c.music) (n[p.hour]++, isActive(p) && a[p.hour]++);
      if (n.reduce((x, y) => x + y, 0) < 200) return null;
      return { viz: "bars", items: n.map((v, h) => ({ label: fmtHour(h), value: v >= 15 ? pct(a[h], v) : 0 })) };
    },
  },
  {
    id: "control-trend", cat: "choice", unit: "%",
    title: "Hands on the wheel",
    desc: "How much of your listening you picked yourself, month by month. Falling means more playlists and autoplay.",
    run: (c) => byMonth(c, (ps) => pct(ps.filter(isActive).length, ps.length)),
  },
  {
    id: "algorithm-wins", cat: "choice", unit: "picks", story: "The algorithm got it right",
    title: "The algorithm got it right",
    desc: "Songs you first heard because autoplay served them, which you then went on to pick yourself again and again.",
    run: (c) =>
      list(
        T(c).filter((t) => {
          const h = c.hist.get(t.key);
          return h && !["clickrow", "playbtn", "backbtn"].includes(h.firstStart) && t.active >= 3;
        }),
        (t) => t.active,
        (t) => t.track,
        (t) => `${t.artist} · arrived by ${c.hist.get(t.key)!.firstStart === "trackdone" ? "autoplay" : "itself"} on ${fmtDay(new Date(c.hist.get(t.key)!.first).toISOString().slice(0, 10), true)}`,
      ),
  },
  {
    id: "self-found", cat: "choice", unit: "%",
    title: "Self-made discoveries",
    desc: "Of the songs that were new to you this period, the share whose very first play was one you picked yourself.",
    run: (c) => {
      const fresh = [...c.hist.values()].filter((h) => h.first >= c.scopeStart && h.first <= c.scopeEnd);
      if (fresh.length < 10 || c.scope === "all") return null;
      const own = fresh.filter((h) => ["clickrow", "playbtn", "backbtn"].includes(h.firstStart)).length;
      return { viz: "number", value: pct(own, fresh.length), caption: `${own.toLocaleString()} of ${fresh.length.toLocaleString()} new songs found by you. The rest arrived on their own.` };
    },
  },

  /* ── SKIPS ── */
  {
    id: "instant-reject", cat: "skips", unit: "sec",
    title: "Instant rejections",
    desc: "Songs you skip fastest: the median seconds before you hit next. (At least 4 skips.)",
    run: (c) => listAsc(T(c).filter((t) => t.skipSecs.length >= 4), (t) => median(t.skipSecs), (t) => t.track, (t) => `${t.artist} · skipped ${t.skips} times`),
  },
  {
    id: "always-finish", cat: "skips", unit: "plays",
    title: "Never leave early",
    desc: "Your most-played songs that you finish at least 95% of the time.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP && t.full / t.events >= 0.95), (t) => t.plays, (t) => t.track, (t) => `${t.artist} · finished ${pct(t.full, t.events)}%`),
  },
  {
    id: "skip-trend", cat: "skips", unit: "%",
    title: "Patience over time",
    desc: "Your skip rate, month by month.",
    run: (c) => byMonth(c, (ps) => pct(ps.filter(isSkip).length, ps.length)),
  },
  {
    id: "shuffle-penalty", cat: "skips", unit: "pts",
    title: "The shuffle penalty",
    desc: "How much more you skip with shuffle on than with it off.",
    run: (c) => {
      const on = c.music.filter((p) => p.shuffle);
      const off = c.music.filter((p) => !p.shuffle);
      if (on.length < 100 || off.length < 100) return null;
      const a = pct(on.filter(isSkip).length, on.length);
      const b = pct(off.filter(isSkip).length, off.length);
      return { viz: "number", value: r1(a - b), caption: `${a}% skipped with shuffle on vs ${b}% with it off` };
    },
  },
  {
    id: "second-chance", cat: "skips", unit: "full plays",
    title: "Second chances",
    desc: "Songs you skipped at least twice in your first five tries, then came around to and played all the way through.",
    run: (c) =>
      list(
        T(c).filter((t) => t.seq.length >= 10 && t.seq.slice(0, 5).filter((s) => s.skip).length >= 2),
        (t) => {
          const after = t.seq.slice(5).filter((s) => s.full).length;
          return after >= 5 ? after : 0;
        },
        (t) => t.track,
        (t) => `${t.artist} · ${t.seq.slice(0, 5).filter((s) => s.skip).length} early skips`,
      ),
  },
  {
    id: "burnout", cat: "skips", unit: "pts", story: "Burnout detector",
    title: "Burnout detector",
    desc: "Songs you wore out. Compares the skip rate in your last third of plays with your first third.",
    run: (c) =>
      list(
        T(c).filter((t) => t.seq.length >= 18),
        (t) => {
          const n = Math.floor(t.seq.length / 3);
          const rate = (xs: typeof t.seq) => xs.filter((s) => s.skip).length / xs.length;
          const d = (rate(t.seq.slice(-n)) - rate(t.seq.slice(0, n))) * 100;
          return d >= 15 ? d : 0;
        },
        (t) => t.track,
        (t) => {
          const n = Math.floor(t.seq.length / 3);
          const rate = (xs: typeof t.seq) => Math.round((xs.filter((s) => s.skip).length / xs.length) * 100);
          return `${t.artist} · skip rate went from ${rate(t.seq.slice(0, n))}% to ${rate(t.seq.slice(-n))}%`;
        },
      ),
  },
  {
    id: "skip-on-sight", cat: "skips", unit: "%",
    title: "Skip-on-sight artists",
    desc: "Artists who keep coming up but whom you skip the most. (Minimum play count applies.)",
    run: (c) => {
      const g = aggregate(c, (t) => t.artist);
      return list(
        [...g.entries()].filter(([, ts]) => sum(ts, (t) => t.events) >= Math.max(20, c.minP * 2)),
        ([, ts]) => pct(sum(ts, (t) => t.skips), sum(ts, (t) => t.events)),
        ([a]) => a,
        ([, ts]) => `${sum(ts, (t) => t.skips)} skips in ${sum(ts, (t) => t.events)} plays`,
      );
    },
  },

  /* ── LIFECYCLE ── */
  {
    id: "longest-relationship", cat: "lifecycle", unit: "days",
    title: "Longest relationships",
    desc: "Songs with the most time between your first play and your latest one. (At least 5 plays.)",
    run: (c) =>
      list(
        T(c).map((t) => ({ t, h: histUpTo(c, t.key) })).filter((x) => x.h && x.h.ts.length >= 5),
        (x) => (x.h!.ts[x.h!.ts.length - 1] - x.h!.ts[0]) / DAY,
        (x) => x.t.track,
        (x) => `${x.t.artist} · since ${fmtDay(new Date(x.h!.ts[0]).toISOString().slice(0, 10), true)}`,
      ),
  },
  {
    id: "fastest-fav", cat: "lifecycle", unit: "days", story: "Love at first listen",
    title: "Love at first listen",
    desc: "The fewest days it took a song to go from first play to 10th play.",
    run: (c) =>
      listAsc(
        T(c).map((t) => ({ t, h: c.hist.get(t.key)! })).filter((x) => x.h.ts.length >= 10 && x.h.ts[9] >= c.scopeStart && x.h.ts[9] <= c.scopeEnd),
        (x) => (x.h.ts[9] - x.h.ts[0]) / DAY,
        (x) => x.t.track,
        (x) => x.t.artist,
      ),
  },
  {
    id: "flash", cat: "lifecycle", unit: "%",
    title: "Flash in the pan",
    desc: "Big songs that burned out fast: 80%+ of their plays landed inside one two-week window.",
    run: (c) =>
      list(
        T(c).filter((t) => t.plays >= Math.max(12, c.minP)),
        (t) => {
          let best = 0;
          for (let lo = 0, hi = 0; hi < t.ts.length; hi++) {
            while (t.ts[hi] - t.ts[lo] > 14 * DAY) lo++;
            best = Math.max(best, hi - lo + 1);
          }
          const s = best / t.plays;
          return s >= 0.8 ? s * 100 : 0;
        },
        (t) => t.track,
        (t) => `${t.artist} · ${t.plays} plays`,
      ),
  },
  {
    id: "slow-burn", cat: "lifecycle", unit: "months",
    title: "Slow burners",
    desc: "Songs that took their time. Their biggest month came half a year or more after you first heard them.",
    run: (c) =>
      list(
        T(c).map((t) => ({ t, h: histUpTo(c, t.key) })).filter((x) => x.h && x.h.ts.length >= 10),
        (x) => {
          const cnt = new Map<number, number>();
          for (const m of x.h!.mi) cnt.set(m, (cnt.get(m) ?? 0) + 1);
          let peak = x.h!.mi[0];
          for (const [m, n] of cnt) if (n > (cnt.get(peak) ?? 0)) peak = m;
          const d = peak - x.h!.mi[0];
          return d >= 6 ? d : 0;
        },
        (x) => x.t.track,
        (x) => `${x.t.artist} · first heard ${fmtDay(new Date(x.h!.ts[0]).toISOString().slice(0, 10), true)}`,
      ),
  },
  {
    id: "evergreen", cat: "lifecycle", unit: "months",
    title: "Evergreens",
    desc: "Songs you keep coming back to: the number of different months they've been played across your whole history.",
    run: (c) => list(T(c).map((t) => ({ t, h: histUpTo(c, t.key) })).filter((x) => x.h), (x) => new Set(x.h!.mi).size, (x) => x.t.track, (x) => x.t.artist),
  },
  {
    id: "artist-longevity", cat: "lifecycle", unit: "months",
    title: "Lifers",
    desc: "Artists heard in the most different months of your entire history.",
    run: (c) => {
      const artists = new Set(T(c).map((t) => t.artist));
      return list(
        [...artists].map((a) => ({ a, n: [...(c.artistMonths.get(a) ?? [])].filter((m) => m <= c.scopeEndMi).length })),
        (x) => x.n,
        (x) => x.a,
        () => "",
      );
    },
  },
  {
    id: "comfort", cat: "lifecycle", unit: "returns",
    title: "Comfort songs",
    desc: "Songs you return to after a break of two weeks or more. These are the ones you go back to.",
    run: (c) =>
      list(
        T(c),
        (t) => {
          const h = c.hist.get(t.key)!;
          let n = 0;
          for (let i = 1; i < h.ts.length; i++) if (h.ts[i] >= c.scopeStart && h.ts[i] <= c.scopeEnd && h.ts[i] - h.ts[i - 1] >= 14 * DAY) n++;
          return n;
        },
        (t) => t.track,
        (t) => t.artist,
      ),
  },
  {
    id: "rotation", cat: "lifecycle", unit: "songs",
    title: "Rotation size",
    desc: "How many different songs you played each month. Wide months and tight months.",
    run: (c) => byMonth(c, (ps) => new Set(ps.filter((p) => p.ms >= STREAM).map(trackKey)).size),
  },
  {
    id: "novelty", cat: "lifecycle", unit: "%",
    title: "Novelty rate",
    desc: "Share of each month's plays that were songs you'd never played before.",
    run: (c) => byMonth(c, (ps) => pct(ps.filter((p) => p.ms >= STREAM && c.hist.get(trackKey(p))?.ts[0] === p.ts).length, ps.filter((p) => p.ms >= STREAM).length)),
  },
  {
    id: "throwback", cat: "lifecycle", unit: "%",
    title: "Throwback share",
    desc: "Share of each month's plays that went to songs you first heard over a year earlier.",
    run: (c) => byMonth(c, (ps) => pct(ps.filter((p) => p.ms >= STREAM && p.ts - (c.hist.get(trackKey(p))?.first ?? p.ts) > 365 * DAY).length, ps.filter((p) => p.ms >= STREAM).length)),
  },
  {
    id: "conversion", cat: "lifecycle", unit: "%",
    title: "Discovery conversion",
    desc: "Of the artists you heard for the first time this year, the share who went on to get 10 or more plays.",
    run: (c) => {
      if (c.scope === "all") return null;
      const g = aggregate(c, (t) => t.artist);
      const fresh = [...g.entries()].filter(([a]) => (c.artistFirst.get(a)?.ts ?? 0) >= c.scopeStart);
      if (fresh.length < 5) return null;
      const kept = fresh.filter(([, ts]) => sum(ts, (t) => t.plays) >= 10).length;
      return { viz: "number", value: pct(kept, fresh.length), caption: `${kept} of ${fresh.length} new artists stuck around for 10+ plays` };
    },
  },
  {
    id: "gateway", cat: "lifecycle", unit: "plays",
    title: "Gateway songs",
    desc: "For your biggest artists, the very first song of theirs you ever played.",
    run: (c) => {
      const g = aggregate(c, (t) => t.artist);
      return list(
        [...g.entries()].filter(([a]) => c.artistFirst.has(a)),
        ([, ts]) => sum(ts, (t) => t.plays),
        ([a]) => a,
        ([a]) => `via “${c.artistFirst.get(a)!.track}” on ${fmtDay(new Date(c.artistFirst.get(a)!.ts).toISOString().slice(0, 10), true)}`,
      );
    },
  },
  {
    id: "taste-stability", cat: "lifecycle", unit: "%",
    title: "Taste stability",
    desc: "How much each month's top 20 artists overlap with the month before. Dips are when your taste shifted.",
    run: (c) => {
      const g = new Map<number, Map<string, number>>();
      for (const p of c.music) {
        const k = c.monthKey(p);
        const m = g.get(k) ?? g.set(k, new Map()).get(k)!;
        m.set(p.artist!, (m.get(p.artist!) ?? 0) + p.ms);
      }
      const ks = [...g.keys()].sort((a, b) => a - b);
      const top = (m: Map<string, number>) => new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map((e) => e[0]));
      const items = ks.slice(1).map((k, i) => {
        const a = top(g.get(ks[i])!);
        const b = top(g.get(k)!);
        const inter = [...a].filter((x) => b.has(x)).length;
        return { label: c.monthName(k), value: pct(inter, new Set([...a, ...b]).size) };
      });
      return items.length >= 3 ? { viz: "line", items } : null;
    },
  },

  /* ── DEPTH ── */
  {
    id: "repeat-chain", cat: "depth", unit: "in a row", story: "Longest repeat streak",
    title: "Longest repeat streak",
    desc: "The most times you played one song back to back without anything in between.",
    run: (c) => {
      let best = { n: 0, p: null as LPlay | null };
      let run = 0;
      let prev = "";
      for (const p of c.music) {
        if (p.ms < STREAM) continue;
        const k = trackKey(p);
        run = k === prev ? run + 1 : 1;
        prev = k;
        if (run > best.n) best = { n: run, p };
      }
      return best.n >= 2 && best.p ? { viz: "number", value: best.n, caption: `“${best.p.track}” by ${best.p.artist}, ${fmtDay(best.p.day, true)}` } : null;
    },
  },
  {
    id: "back-to-back", cat: "depth", unit: "repeats",
    title: "Instant replays",
    desc: "Songs you most often played again immediately after they finished.",
    run: (c) => {
      const m = new Map<string, { p: LPlay; n: number }>();
      let prev = "";
      for (const p of c.music) {
        if (p.ms < STREAM) continue;
        const k = trackKey(p);
        if (k === prev) {
          const v = m.get(k) ?? { p, n: 0 };
          v.n++;
          m.set(k, v);
        }
        prev = k;
      }
      return list([...m.values()], (v) => v.n, (v) => v.p.track!, (v) => v.p.artist!);
    },
  },
  {
    id: "one-song-albums", cat: "depth", unit: "%",
    title: "One-song albums",
    desc: "Albums you play a lot, but almost always the same one song from.",
    run: (c) => {
      const g = aggregate(c, (t) => (t.album && t.album !== t.track ? `${t.album}␟${t.artist}` : null));
      return list(
        [...g.values()].filter((ts) => ts.length >= 2 && sum(ts, (t) => t.plays) >= Math.max(15, c.minP)),
        (ts) => {
          const s = Math.max(...ts.map((t) => t.plays)) / sum(ts, (t) => t.plays);
          return s >= 0.7 ? s * 100 : 0;
        },
        (ts) => ts[0].album!,
        (ts) => `${ts[0].artist} · it's all “${[...ts].sort((a, b) => b.plays - a.plays)[0].track}”`,
      );
    },
  },
  {
    id: "artist-depth", cat: "depth", unit: "songs",
    title: "Deepest catalogue dives",
    desc: "Artists ranked by how many different songs of theirs you played (each at least once for 30s+).",
    run: (c) => {
      const g = aggregate(c, (t) => (t.plays ? t.artist : null));
      return list([...g.entries()], ([, ts]) => ts.length, ([a]) => a, ([, ts]) => `${sum(ts, (t) => t.plays)} plays`);
    },
  },
  {
    id: "one-song-artists", cat: "depth", unit: "%",
    title: "One-song relationships",
    desc: "Artists you play a lot, but nearly always the same song by them.",
    run: (c) => {
      const g = aggregate(c, (t) => t.artist);
      return list(
        [...g.values()].filter((ts) => sum(ts, (t) => t.plays) >= Math.max(15, c.minP * 2)),
        (ts) => {
          const s = Math.max(...ts.map((t) => t.plays)) / sum(ts, (t) => t.plays);
          return s >= 0.6 ? s * 100 : 0;
        },
        (ts) => ts[0].artist,
        (ts) => `“${[...ts].sort((a, b) => b.plays - a.plays)[0].track}”`,
      );
    },
  },
  {
    id: "album-flow", cat: "depth", unit: "%",
    title: "Albums you let play",
    desc: "Share of an album's plays that came from its previous song ending (shuffle off). In other words, records you listen to as records.",
    run: (c) => {
      const flow = new Map<string, { n: number; f: number; p: LPlay }>();
      let prev: LPlay | null = null;
      for (const p of c.music) {
        if (p.album) {
          const k = `${p.album}␟${p.artist}`;
          const v = flow.get(k) ?? { n: 0, f: 0, p };
          v.n++;
          if (prev && !p.shuffle && p.reasonStart === "trackdone" && prev.album === p.album && prev.artist === p.artist && trackKey(prev) !== trackKey(p)) v.f++;
          flow.set(k, v);
        }
        prev = p;
      }
      return list([...flow.values()].filter((v) => v.n >= Math.max(20, c.minP * 2)), (v) => pct(v.f, v.n), (v) => v.p.album!, (v) => `${v.p.artist} · ${v.n} plays`);
    },
  },

  /* ── RITUALS ── */
  {
    id: "morning", cat: "rituals", unit: "%",
    title: "Morning anthems",
    desc: "Songs that live in your mornings: the share of their plays between 5 and 10am.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => { const s = sum(t.hours.slice(5, 10), (x) => x) / t.plays; return s >= 0.35 ? s * 100 : 0; }, (t) => t.track, (t) => t.artist),
  },
  {
    id: "midnight", cat: "rituals", unit: "%",
    title: "After-midnight songs",
    desc: "Songs that mostly come out between midnight and 4am.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => { const s = sum(t.hours.slice(0, 4), (x) => x) / t.plays; return s >= 0.25 ? s * 100 : 0; }, (t) => t.track, (t) => t.artist),
  },
  {
    id: "commute", cat: "rituals", unit: "%",
    title: "Commute soundtrack",
    desc: "Songs concentrated in weekday rush hours (7–9am and 4–7pm).",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => { const s = t.commute / t.plays; return s >= 0.35 ? s * 100 : 0; }, (t) => t.track, (t) => t.artist),
  },
  {
    id: "weekend", cat: "rituals", unit: "%",
    title: "Weekend-only songs",
    desc: "Songs that mostly come out on Saturdays and Sundays. An even spread would be 29%.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => { const s = t.weekend / t.plays; return s >= 0.5 ? s * 100 : 0; }, (t) => t.track, (t) => t.artist),
  },
  {
    id: "summer", cat: "rituals", unit: "%",
    title: "Summer songs",
    desc: "Songs that mostly come out in June, July and August.",
    run: (c) => list(T(c).filter((t) => t.plays >= c.minP), (t) => { const s = t.summer / t.plays; return s >= 0.5 ? s * 100 : 0; }, (t) => t.track, (t) => t.artist),
  },
  {
    id: "daily-ritual", cat: "rituals", unit: "days",
    title: "Daily rituals",
    desc: "Songs played on the most different days. These are habits, not binges.",
    run: (c) => list(T(c), (t) => t.days.size, (t) => t.track, (t) => `${t.artist} · ${t.plays} plays`),
  },
  {
    id: "power-slot", cat: "rituals", unit: "", story: "Your power hour",
    title: "Your power hour",
    desc: "The single weekday-and-hour slot where you listen the most.",
    run: (c) => {
      const m = new Array(7 * 24).fill(0);
      let tot = 0;
      for (const p of c.music) (m[p.dow * 24 + p.hour] += p.ms), (tot += p.ms);
      if (!tot) return null;
      const i = m.indexOf(Math.max(...m));
      return { viz: "number", value: `${DOWS[Math.floor(i / 24)]} ${fmtHour(i % 24)}`, caption: `${Math.round(m[i] / 60_000).toLocaleString()} minutes in that one weekly hour. That's ${pct(m[i], tot)}% of all your listening, in 0.6% of the week.` };
    },
  },
  {
    id: "session-hour", cat: "rituals", unit: "min",
    title: "Session length by start time",
    desc: "Average length of a listening session, by the hour it started.",
    run: (c) => {
      const s = new Array(24).fill(0);
      const n = new Array(24).fill(0);
      for (const ss of c.sessions) {
        const h = ss[0].hour;
        n[h]++;
        s[h] += (ss[ss.length - 1].ts - (ss[0].ts - ss[0].ms)) / 60_000;
      }
      if (c.sessions.length < 30) return null;
      return { viz: "bars", items: s.map((v, h) => ({ label: fmtHour(h), value: n[h] >= 3 ? r1(v / n[h]) : 0 })) };
    },
  },

  /* ── CONTEXT ── */
  {
    id: "offline", cat: "context", unit: "plays",
    title: "Offline essentials",
    desc: "Songs you played most while offline. These are the ones you downloaded for planes, trains and dead zones.",
    run: (c) => list(T(c), (t) => t.offline, (t) => t.track, (t) => t.artist),
  },
  {
    id: "device-signature", cat: "context", unit: "plays",
    title: "Device signatures",
    desc: "The top song on each kind of device you use.",
    run: (c) => {
      const m = new Map<string, Map<string, { p: LPlay; n: number }>>();
      for (const p of c.music) {
        if (p.ms < STREAM) continue;
        const d = deviceFamily(p.platform);
        const dm = m.get(d) ?? m.set(d, new Map()).get(d)!;
        const k = trackKey(p);
        const v = dm.get(k) ?? { p, n: 0 };
        v.n++;
        dm.set(k, v);
      }
      const rows = [...m.entries()].map(([d, dm]) => ({ d, top: [...dm.values()].sort((a, b) => b.n - a.n)[0] }));
      return rows.length >= 2 ? list(rows, (r) => r.top.n, (r) => r.d, (r) => `“${r.top.p.track}” · ${r.top.p.artist}`) : null;
    },
  },
  {
    id: "travel", cat: "context", unit: "plays",
    title: "Travel soundtrack",
    desc: "Your top songs while connected from outside your home country.",
    run: (c) => {
      const cc = new Map<string, number>();
      for (const p of c.music) cc.set(p.country, (cc.get(p.country) ?? 0) + p.ms);
      const home = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const m = new Map<string, { p: LPlay; n: number; where: Set<string> }>();
      for (const p of c.music) {
        if (p.ms < STREAM || p.country === home || p.country === "ZZ") continue;
        const k = trackKey(p);
        const v = m.get(k) ?? { p, n: 0, where: new Set() };
        v.n++;
        v.where.add(p.country);
        m.set(k, v);
      }
      return list([...m.values()], (v) => v.n, (v) => v.p.track!, (v) => `${v.p.artist} · ${[...v.where].join(", ")}`);
    },
  },
  {
    id: "shuffle-luck", cat: "context", unit: "plays",
    title: "Shuffle's best picks",
    desc: "Songs shuffle served up that you let play all the way through, most often.",
    run: (c) => list(T(c), (t) => t.shuffleWin, (t) => t.track, (t) => t.artist),
  },
  {
    id: "podcast-finish", cat: "context", unit: "%",
    title: "Podcast follow-through",
    desc: "For each show, the share of episodes you started that you actually finished.",
    run: (c) => {
      const shows = new Map<string, Map<string, boolean>>();
      for (const p of c.scoped) {
        if (p.kind !== "episode" || !p.show) continue;
        const m = shows.get(p.show) ?? shows.set(p.show, new Map()).get(p.show)!;
        const k = p.uri ?? p.episode ?? "";
        m.set(k, (m.get(k) ?? false) || p.reasonEnd === "trackdone");
      }
      return list(
        [...shows.entries()].filter(([, m]) => m.size >= 3),
        ([, m]) => pct([...m.values()].filter(Boolean).length, m.size) || 0.01,
        ([sh]) => sh,
        ([, m]) => `${[...m.values()].filter(Boolean).length} of ${m.size} episodes finished`,
      );
    },
  },
];

/* ───────────── runner ───────────── */

export interface DeepResult {
  m: DeepMetric;
  out: MetricOutput;
}

export function runDeep(all: LPlay[], scope: Scope): DeepResult[] {
  const ctx = buildCtx(all, scope);
  const res: DeepResult[] = [];
  for (const m of DEEP_METRICS) {
    try {
      const out = m.run(ctx);
      if (out && !(out.viz !== "number" && out.items.length === 0)) res.push({ m, out });
    } catch {
      /* a metric failing should never break the page */
    }
  }
  return res;
}

/** Run one metric with a longer ranking (used by the deep-dive panel). */
export function runOne(all: LPlay[], scope: Scope, id: string, limit = 30): MetricOutput | null {
  const m = DEEP_METRICS.find((x) => x.id === id);
  if (!m) return null;
  LIMIT = limit;
  try {
    return m.run(buildCtx(all, scope));
  } catch {
    return null;
  } finally {
    LIMIT = 10;
  }
}
