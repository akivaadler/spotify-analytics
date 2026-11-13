import type { LPlay, Scope } from "./types";

/* ───────────────────────── basics ───────────────────────── */

export const QUALIFY_MS = 30_000; // Spotify counts a "stream" after 30s
const DAY_MS = 86_400_000;
export const isMusic = (p: LPlay) => p.kind === "track" && !!p.track && !!p.artist;
export const isSkip = (p: LPlay) => p.skipped || (p.reasonEnd === "fwdbtn" && p.ms < QUALIFY_MS);
export const isIntentional = (p: LPlay) => p.reasonStart === "clickrow" || p.reasonStart === "playbtn" || p.reasonStart === "backbtn";
export const trackKey = (p: LPlay) => p.uri ?? `${p.track}␟${p.artist}`;
export const albumKey = (p: LPlay) => `${p.album ?? "—"}␟${p.artist}`;
export const minutes = (ms: number) => ms / 60_000;

export function inScope(p: LPlay, scope: Scope) {
  return scope === "all" || p.year === scope;
}

export function yearsIn(plays: LPlay[]): number[] {
  const ys = new Set<number>();
  for (const p of plays) if (p.ms > 0) ys.add(p.year);
  return [...ys].sort((a, b) => a - b);
}

/* ───────────────────────── generic group/rank ───────────────────────── */

export interface TrackRow { key: string; track: string; artist: string; album: string | null; plays: number; ms: number; skips: number; firstTs: number }
export interface ArtistRow { artist: string; plays: number; ms: number; tracks: number; share: number; firstTs: number }
export interface AlbumRow { album: string; artist: string; plays: number; ms: number; tracks: number }

export function trackTable(music: LPlay[]): TrackRow[] {
  const m = new Map<string, TrackRow>();
  for (const p of music) {
    const k = trackKey(p);
    let r = m.get(k);
    if (!r) m.set(k, (r = { key: k, track: p.track!, artist: p.artist!, album: p.album, plays: 0, ms: 0, skips: 0, firstTs: p.ts }));
    if (p.ms >= QUALIFY_MS) r.plays++;
    if (isSkip(p)) r.skips++;
    r.ms += p.ms;
  }
  return [...m.values()];
}

export interface RankOptions {
  by: "plays" | "minutes";
  onePerAlbum: boolean;
  onePerArtist: boolean;
  n: number;
  minPlays?: number;
}

/** Ranked tracks with diversity rules (e.g. at most one song per album). */
export function rankTracks(rows: TrackRow[], o: RankOptions): TrackRow[] {
  const sorted = [...rows]
    .filter((r) => r.plays >= (o.minPlays ?? 1))
    .sort((a, b) => (o.by === "plays" ? b.plays - a.plays || b.ms - a.ms : b.ms - a.ms));
  const albums = new Set<string>();
  const artists = new Set<string>();
  const out: TrackRow[] = [];
  for (const r of sorted) {
    const ak = `${r.album ?? r.track}␟${r.artist}`;
    if (o.onePerAlbum && albums.has(ak)) continue;
    if (o.onePerArtist && artists.has(r.artist)) continue;
    albums.add(ak);
    artists.add(r.artist);
    out.push(r);
    if (out.length >= o.n) break;
  }
  return out;
}

export function artistTable(music: LPlay[]): ArtistRow[] {
  const m = new Map<string, ArtistRow & { set: Set<string> }>();
  let total = 0;
  for (const p of music) {
    let r = m.get(p.artist!);
    if (!r) m.set(p.artist!, (r = { artist: p.artist!, plays: 0, ms: 0, tracks: 0, share: 0, firstTs: p.ts, set: new Set() }));
    if (p.ms >= QUALIFY_MS) r.plays++;
    r.ms += p.ms;
    r.set.add(trackKey(p));
    total += p.ms;
  }
  return [...m.values()]
    .map(({ set, ...r }) => ({ ...r, tracks: set.size, share: total ? r.ms / total : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

export function albumTable(music: LPlay[]): AlbumRow[] {
  const m = new Map<string, AlbumRow & { set: Set<string> }>();
  for (const p of music) {
    if (!p.album) continue;
    const k = albumKey(p);
    let r = m.get(k);
    if (!r) m.set(k, (r = { album: p.album, artist: p.artist!, plays: 0, ms: 0, tracks: 0, set: new Set() }));
    if (p.ms >= QUALIFY_MS) r.plays++;
    r.ms += p.ms;
    if (p.ms >= QUALIFY_MS) r.set.add(trackKey(p));
  }
  return [...m.values()].map(({ set, ...r }) => ({ ...r, tracks: set.size })).sort((a, b) => b.ms - a.ms);
}

function topBy<T>(map: Map<string, T>, score: (v: T) => number): [string, T] | null {
  let best: [string, T] | null = null;
  let bs = -Infinity;
  for (const [k, v] of map) {
    const s = score(v);
    if (s > bs) (bs = s), (best = [k, v]);
  }
  return best;
}

/* ───────────────────────── the report ───────────────────────── */

export interface Report {
  scope: Scope;
  label: string;
  summary: {
    minutes: number;
    streams: number;
    tracks: number;
    artists: number;
    albums: number;
    activeDays: number;
    spanDays: number;
    podcastMinutes: number;
    avgPerActiveDay: number;
  };
  topTracks: TrackRow[]; // album-diverse
  rawTopSameAlbum: number; // how many of the naive top 5 shared an album
  topArtists: ArtistRow[];
  topAlbums: AlbumRow[];
  discovery: {
    newArtists: number;
    newTracks: number;
    shareOfMinutes: number; // minutes on artists first heard in scope
    topNewArtist: ArtistRow | null;
    topNewTrack: TrackRow | null;
  };
  obsession: { track: string; artist: string; peak: number; from: string } | null;
  onRepeat: { track: string; artist: string; plays: number; day: string } | null;
  streak: { days: number; from: string; to: string };
  artistStreak: { artist: string; days: number; from: string } | null;
  clock: { hours: number[]; dows: number[]; peakHour: number; nightShare: number; morningShare: number; weekendShare: number };
  lateNightArtist: { artist: string; minutes: number } | null;
  weekendArtist: { artist: string; lift: number } | null;
  months: { month: number; minutes: number; topArtist: string | null; topTrack: string | null }[];
  skips: {
    rate: number;
    avgSecondsBeforeSkip: number;
    loveHate: TrackRow | null; // played a lot AND skipped a lot
    neverSkip: { artist: string; plays: number; rate: number } | null;
  };
  intent: { intentional: number; shuffle: number; autoplay: number };
  diversity: { effectiveArtists: number; top10Share: number; score: number };
  comebacks: { track: string; artist: string; gapDays: number; plays: number }[];
  biggestDay: { day: string; minutes: number; topArtist: string | null } | null;
  sessions: { count: number; avgMinutes: number; longest: { minutes: number; day: string; tracks: number } | null };
  albumRuns: { album: string; artist: string; runs: number }[];
  quietFavorites: TrackRow[];
  podcasts: { show: string; minutes: number; episodes: number }[];
  movers: { rising: { artist: string; delta: number }[]; fading: { artist: string; delta: number }[] } | null;
  ridesOrDies: { artist: string; years: number; total: number }[];
  places: { countries: string[]; offlineShare: number; devices: { name: string; share: number }[] };
  firstSong: { track: string; artist: string; day: string } | null;
  persona: Persona;
}

export interface Persona {
  id: string;
  name: string;
  blurb: string;
  traits: { label: string; value: number }[]; // 0..1
}

export function buildReport(all: LPlay[], scope: Scope): Report {
  const plays = all.filter((p) => inScope(p, scope) && p.ms > 0);
  const music = plays.filter(isMusic);
  const label = scope === "all" ? "All time" : String(scope);

  /* summary */
  let totalMs = 0;
  let podcastMs = 0;
  let streams = 0;
  const days = new Set<number>();
  for (const p of plays) {
    totalMs += p.ms;
    if (p.kind !== "track") podcastMs += p.ms;
    if (p.ms >= QUALIFY_MS) streams++;
    days.add(p.dayIndex);
  }
  const tRows = trackTable(music);
  const aRows = artistTable(music);
  const alRows = albumTable(music);
  const spanDays = plays.length ? plays[plays.length - 1].dayIndex - plays[0].dayIndex + 1 : 0;

  /* top tracks, album-diverse */
  const topTracks = rankTracks(tRows, { by: "plays", onePerAlbum: true, onePerArtist: false, n: 5 });
  const naive = rankTracks(tRows, { by: "plays", onePerAlbum: false, onePerArtist: false, n: 5 });
  const albumCounts = new Map<string, number>();
  for (const r of naive) albumCounts.set(`${r.album}␟${r.artist}`, (albumCounts.get(`${r.album}␟${r.artist}`) ?? 0) + 1);
  const rawTopSameAlbum = Math.max(0, ...albumCounts.values()) > 1 ? Math.max(...albumCounts.values()) : 0;

  /* discovery (first-ever play falls in scope) */
  const firstArtist = new Map<string, number>();
  const firstTrack = new Map<string, number>();
  for (const p of all) {
    if (!isMusic(p) || p.ms < QUALIFY_MS) continue;
    if (!firstArtist.has(p.artist!)) firstArtist.set(p.artist!, p.ts);
    const k = trackKey(p);
    if (!firstTrack.has(k)) firstTrack.set(k, p.ts);
  }
  const scopeStart = music.length ? music[0].ts : 0;
  const isNewArtist = (a: string) => scope !== "all" && (firstArtist.get(a) ?? Infinity) >= scopeStart;
  const newArtistRows = scope === "all" ? [] : aRows.filter((a) => isNewArtist(a.artist));
  const newTrackRows = scope === "all" ? [] : tRows.filter((t) => (firstTrack.get(t.key) ?? Infinity) >= scopeStart).sort((a, b) => b.plays - a.plays);
  const newMs = newArtistRows.reduce((s, a) => s + a.ms, 0);
  const musicMs = aRows.reduce((s, a) => s + a.ms, 0);

  /* obsession: best rolling-7-day play count for any single song */
  const byTrack = new Map<string, LPlay[]>();
  for (const p of music) if (p.ms >= QUALIFY_MS) (byTrack.get(trackKey(p)) ?? byTrack.set(trackKey(p), []).get(trackKey(p))!).push(p);
  let obsession: Report["obsession"] = null;
  for (const list of byTrack.values()) {
    let lo = 0;
    for (let hi = 0; hi < list.length; hi++) {
      while (list[hi].ts - list[lo].ts > 7 * DAY_MS) lo++;
      const c = hi - lo + 1;
      if (!obsession || c > obsession.peak) obsession = { track: list[hi].track!, artist: list[hi].artist!, peak: c, from: list[lo].day };
    }
  }

  /* on repeat: most plays of one song in one day */
  const dayTrack = new Map<string, { p: LPlay; n: number }>();
  for (const p of music) {
    if (p.ms < QUALIFY_MS) continue;
    const k = p.day + "␟" + trackKey(p);
    const v = dayTrack.get(k);
    if (v) v.n++;
    else dayTrack.set(k, { p, n: 1 });
  }
  const rep = topBy(dayTrack, (v) => v.n);
  const onRepeat = rep ? { track: rep[1].p.track!, artist: rep[1].p.artist!, plays: rep[1].n, day: rep[1].p.day } : null;

  /* streaks */
  const sortedDays = [...days].sort((a, b) => a - b);
  let best = { days: 0, from: 0, to: 0 };
  for (let i = 0, start = 0; i < sortedDays.length; i++) {
    if (i > 0 && sortedDays[i] !== sortedDays[i - 1] + 1) start = i;
    const len = i - start + 1;
    if (len > best.days) best = { days: len, from: sortedDays[start], to: sortedDays[i] };
  }
  const dayStr = (di: number) => new Date(di * DAY_MS).toISOString().slice(0, 10);
  const artistDays = new Map<string, Set<number>>();
  for (const p of music) if (p.ms >= QUALIFY_MS) (artistDays.get(p.artist!) ?? artistDays.set(p.artist!, new Set()).get(p.artist!))!.add(p.dayIndex);
  let artistStreak: Report["artistStreak"] = null;
  for (const [artist, set] of artistDays) {
    const ds = [...set].sort((a, b) => a - b);
    for (let i = 0, start = 0; i < ds.length; i++) {
      if (i > 0 && ds[i] !== ds[i - 1] + 1) start = i;
      const len = i - start + 1;
      if (!artistStreak || len > artistStreak.days) artistStreak = { artist, days: len, from: dayStr(ds[start]) };
    }
  }

  /* clock */
  const hours = new Array(24).fill(0);
  const dows = new Array(7).fill(0);
  const night = new Map<string, number>();
  const wkArtist = new Map<string, { we: number; wd: number }>();
  let weMs = 0;
  for (const p of plays) {
    hours[p.hour] += p.ms;
    dows[p.dow] += p.ms;
    if (p.dow >= 5) weMs += p.ms;
    if (isMusic(p)) {
      if (p.hour < 4) night.set(p.artist!, (night.get(p.artist!) ?? 0) + p.ms);
      const w = wkArtist.get(p.artist!) ?? { we: 0, wd: 0 };
      if (p.dow >= 5) w.we += p.ms;
      else w.wd += p.ms;
      wkArtist.set(p.artist!, w);
    }
  }
  const peakHour = hours.indexOf(Math.max(...hours));
  const sumH = (from: number, to: number) => hours.slice(from, to).reduce((s, x) => s + x, 0);
  const nightShare = totalMs ? (sumH(22, 24) + sumH(0, 4)) / totalMs : 0;
  const morningShare = totalMs ? sumH(5, 10) / totalMs : 0;
  const weekendShare = totalMs ? weMs / totalMs : 0;
  const ln = topBy(night, (v) => v);
  const lateNightArtist = ln && ln[1] > 30 * 60_000 ? { artist: ln[0], minutes: minutes(ln[1]) } : null;
  let weekendArtist: Report["weekendArtist"] = null;
  {
    const totWe = [...wkArtist.values()].reduce((s, v) => s + v.we, 0) || 1;
    const totWd = [...wkArtist.values()].reduce((s, v) => s + v.wd, 0) || 1;
    for (const [artist, v] of wkArtist) {
      if (v.we < 60 * 60_000) continue; // at least an hour on weekends
      const lift = v.we / totWe / ((v.wd + 60_000) / totWd);
      if (!weekendArtist || lift > weekendArtist.lift) weekendArtist = { artist, lift };
    }
  }

  /* months */
  const monthMap = new Map<number, { ms: number; artists: Map<string, number>; tracks: Map<string, number> }>();
  for (const p of plays) {
    const key = scope === "all" ? p.year * 100 + p.month : p.month;
    const v = monthMap.get(key) ?? { ms: 0, artists: new Map(), tracks: new Map() };
    v.ms += p.ms;
    if (isMusic(p)) {
      v.artists.set(p.artist!, (v.artists.get(p.artist!) ?? 0) + p.ms);
      if (p.ms >= QUALIFY_MS) v.tracks.set(p.track!, (v.tracks.get(p.track!) ?? 0) + 1);
    }
    monthMap.set(key, v);
  }
  const months = [...monthMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, v]) => ({ month, minutes: minutes(v.ms), topArtist: topBy(v.artists, (x) => x)?.[0] ?? null, topTrack: topBy(v.tracks, (x) => x)?.[0] ?? null }));

  /* skips */
  let skipN = 0;
  let skipMs = 0;
  for (const p of music) if (isSkip(p)) (skipN++, (skipMs += p.ms));
  // love/hate: played a lot AND skipped a large share of the time
  const lhScore = (r: TrackRow) => Math.sqrt(r.plays) * (r.skips / (r.plays + r.skips));
  const loveHate = [...tRows].filter((r) => r.plays >= 8 && r.skips / (r.plays + r.skips) >= 0.25).sort((a, b) => lhScore(b) - lhScore(a))[0] ?? null;
  const artistSkip = new Map<string, { n: number; s: number }>();
  for (const p of music) {
    const v = artistSkip.get(p.artist!) ?? { n: 0, s: 0 };
    v.n++;
    if (isSkip(p)) v.s++;
    artistSkip.set(p.artist!, v);
  }
  let neverSkip: Report["skips"]["neverSkip"] = null;
  const minNS = Math.max(20, Math.round(music.length / 400));
  for (const [artist, v] of artistSkip) {
    if (v.n < minNS) continue;
    const rate = v.s / v.n;
    if (!neverSkip || rate < neverSkip.rate || (rate === neverSkip.rate && v.n > neverSkip.plays)) neverSkip = { artist, plays: v.n, rate };
  }

  /* intent */
  let intentional = 0;
  let shuffle = 0;
  let autoplay = 0;
  for (const p of music) {
    if (isIntentional(p)) intentional++;
    if (p.shuffle) shuffle++;
    if (p.reasonStart === "trackdone") autoplay++;
  }
  const mN = music.length || 1;

  /* diversity — "effective number of artists" = exp(Shannon entropy) */
  let H = 0;
  for (const a of aRows) if (a.share > 0) H -= a.share * Math.log(a.share);
  const effectiveArtists = Math.exp(H);
  const top10Share = aRows.slice(0, 10).reduce((s, a) => s + a.share, 0);

  /* comebacks — songs returning after 1+ year of silence */
  const lastSeen = new Map<string, number>();
  const cb = new Map<string, { track: string; artist: string; gapDays: number; plays: number }>();
  for (const p of all) {
    if (!isMusic(p) || p.ms < QUALIFY_MS) continue;
    const k = trackKey(p);
    const prev = lastSeen.get(k);
    if (inScope(p, scope)) {
      const existing = cb.get(k);
      if (existing) existing.plays++;
      else if (prev !== undefined && p.ts - prev > 365 * DAY_MS) cb.set(k, { track: p.track!, artist: p.artist!, gapDays: Math.round((p.ts - prev) / DAY_MS), plays: 1 });
    }
    lastSeen.set(k, p.ts);
  }
  const comebacks = [...cb.values()].sort((a, b) => b.plays - a.plays || b.gapDays - a.gapDays).slice(0, 5);

  /* biggest day */
  const dayMs = new Map<string, { ms: number; artists: Map<string, number> }>();
  for (const p of plays) {
    const v = dayMs.get(p.day) ?? { ms: 0, artists: new Map() };
    v.ms += p.ms;
    if (isMusic(p)) v.artists.set(p.artist!, (v.artists.get(p.artist!) ?? 0) + p.ms);
    dayMs.set(p.day, v);
  }
  const bd = topBy(dayMs, (v) => v.ms);
  const biggestDay = bd ? { day: bd[0], minutes: minutes(bd[1].ms), topArtist: topBy(bd[1].artists, (x) => x)?.[0] ?? null } : null;

  /* sessions — 30 min of silence ends a session */
  let sCount = 0;
  let sTotal = 0;
  let longest: Report["sessions"]["longest"] = null;
  {
    let sStart = -1;
    let sEnd = -1;
    let sTracks = 0;
    let sDay = "";
    const close = () => {
      if (sStart < 0) return;
      const m = minutes(sEnd - sStart);
      sCount++;
      sTotal += m;
      if (!longest || m > longest.minutes) longest = { minutes: m, day: sDay, tracks: sTracks };
    };
    for (const p of plays) {
      const start = p.ts - p.ms;
      if (sStart < 0 || start - sEnd > 30 * 60_000) {
        close();
        sStart = start;
        sTracks = 0;
        sDay = p.day;
      }
      sEnd = Math.max(sEnd, p.ts);
      sTracks++;
    }
    close();
  }

  /* album runs — 5+ consecutive, unshuffled songs from one album */
  const runs = new Map<string, { album: string; artist: string; runs: number }>();
  {
    let cur = "";
    let len = 0;
    let last: LPlay | null = null;
    const flush = () => {
      if (len >= 5 && last?.album) {
        const v = runs.get(cur) ?? { album: last.album, artist: last.artist!, runs: 0 };
        v.runs++;
        runs.set(cur, v);
      }
    };
    for (const p of music) {
      const k = albumKey(p);
      if (!p.shuffle && p.album && k === cur && p.ms >= QUALIFY_MS) len++;
      else {
        flush();
        cur = !p.shuffle && p.album ? k : "";
        len = cur ? 1 : 0;
      }
      last = p;
    }
    flush();
  }
  const albumRuns = [...runs.values()].sort((a, b) => b.runs - a.runs).slice(0, 5);

  /* quiet favourites — never skipped, played often, from outside your top 10 artists */
  const top10 = new Set(aRows.slice(0, 10).map((a) => a.artist));
  const quietFavorites = tRows
    .filter((r) => !top10.has(r.artist) && r.skips === 0 && r.plays >= 6)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  /* podcasts */
  const pod = new Map<string, { ms: number; eps: Set<string> }>();
  for (const p of plays) {
    if (p.kind === "track" || !p.show) continue;
    const v = pod.get(p.show) ?? { ms: 0, eps: new Set() };
    v.ms += p.ms;
    v.eps.add(p.episode ?? p.uri ?? "");
    pod.set(p.show, v);
  }
  const podcasts = [...pod.entries()].map(([show, v]) => ({ show, minutes: minutes(v.ms), episodes: v.eps.size })).sort((a, b) => b.minutes - a.minutes).slice(0, 5);

  /* movers vs previous year */
  let movers: Report["movers"] = null;
  if (scope !== "all") {
    const prev = artistTable(all.filter((p) => p.year === scope - 1 && isMusic(p) && p.ms > 0));
    if (prev.length) {
      const prevShare = new Map(prev.map((a) => [a.artist, a.share]));
      const curShare = new Map(aRows.map((a) => [a.artist, a.share]));
      const names = new Set([...prevShare.keys(), ...curShare.keys()]);
      const deltas = [...names].map((artist) => ({ artist, delta: (curShare.get(artist) ?? 0) - (prevShare.get(artist) ?? 0) }));
      deltas.sort((a, b) => b.delta - a.delta);
      movers = { rising: deltas.slice(0, 3).filter((d) => d.delta > 0), fading: deltas.slice(-3).reverse().filter((d) => d.delta < 0) };
    }
  }

  /* ride-or-dies: in your top 10 in the most years */
  const byYear = new Map<number, LPlay[]>();
  for (const p of all) if (isMusic(p) && p.ms > 0 && (scope === "all" || p.year <= scope)) (byYear.get(p.year) ?? byYear.set(p.year, []).get(p.year)!).push(p);
  const yearsCount = new Map<string, number>();
  for (const list of byYear.values()) for (const a of artistTable(list).slice(0, 10)) yearsCount.set(a.artist, (yearsCount.get(a.artist) ?? 0) + 1);
  const ridesOrDies = [...yearsCount.entries()]
    .filter(([, n]) => n >= 2)
    .map(([artist, years]) => ({ artist, years, total: byYear.size }))
    .sort((a, b) => b.years - a.years)
    .slice(0, 5);

  /* places & devices */
  const countries = new Set<string>();
  let offMs = 0;
  const dev = new Map<string, number>();
  for (const p of plays) {
    if (p.country !== "ZZ") countries.add(p.country);
    if (p.offline) offMs += p.ms;
    const fam = deviceFamily(p.platform);
    dev.set(fam, (dev.get(fam) ?? 0) + p.ms);
  }
  const devices = [...dev.entries()].map(([name, ms]) => ({ name, share: totalMs ? ms / totalMs : 0 })).sort((a, b) => b.share - a.share);

  const fs = music.find((p) => p.ms >= QUALIFY_MS);
  const firstSong = fs ? { track: fs.track!, artist: fs.artist!, day: fs.day } : null;

  const discovery = {
    newArtists: newArtistRows.length,
    newTracks: newTrackRows.length,
    shareOfMinutes: musicMs ? newMs / musicMs : 0,
    topNewArtist: newArtistRows[0] ?? null,
    topNewTrack: newTrackRows[0] ?? null,
  };
  const intent = { intentional: intentional / mN, shuffle: shuffle / mN, autoplay: autoplay / mN };
  const diversityScore = Math.min(100, Math.round((Math.log(effectiveArtists + 1) / Math.log(200)) * 100));
  const replay = tRows.length ? tRows.reduce((s, r) => s + r.plays, 0) / tRows.length : 0;

  const report: Report = {
    scope,
    label,
    summary: {
      minutes: minutes(totalMs),
      streams,
      tracks: tRows.length,
      artists: aRows.length,
      albums: alRows.length,
      activeDays: days.size,
      spanDays,
      podcastMinutes: minutes(podcastMs),
      avgPerActiveDay: days.size ? minutes(totalMs) / days.size : 0,
    },
    topTracks,
    rawTopSameAlbum,
    topArtists: aRows.slice(0, 10),
    topAlbums: alRows.slice(0, 10),
    discovery,
    obsession,
    onRepeat,
    streak: { days: best.days, from: dayStr(best.from), to: dayStr(best.to) },
    artistStreak,
    clock: { hours: hours.map(minutes), dows: dows.map(minutes), peakHour, nightShare, morningShare, weekendShare },
    lateNightArtist,
    weekendArtist,
    months,
    skips: { rate: skipN / mN, avgSecondsBeforeSkip: skipN ? skipMs / skipN / 1000 : 0, loveHate, neverSkip },
    intent,
    diversity: { effectiveArtists, top10Share, score: diversityScore },
    comebacks,
    biggestDay,
    sessions: { count: sCount, avgMinutes: sCount ? sTotal / sCount : 0, longest },
    albumRuns,
    quietFavorites,
    podcasts,
    movers,
    ridesOrDies,
    places: { countries: [...countries], offlineShare: totalMs ? offMs / totalMs : 0, devices },
    firstSong,
    persona: { id: "", name: "", blurb: "", traits: [] },
  };
  report.persona = persona(report, replay);
  return report;
}

export function deviceFamily(p: string): string {
  if (/android/i.test(p)) return "Android";
  if (/\bios\b|iphone|ipad/i.test(p)) return "iPhone / iPad";
  if (/mac ?os|os x/i.test(p)) return "Mac";
  if (/windows/i.test(p)) return "Windows";
  if (/web_player|web player|browser/i.test(p)) return "Web";
  if (/partner|cast|sonos|speaker|tv|car|playstation|xbox/i.test(p)) return "Speakers, TV & car";
  if (/linux/i.test(p)) return "Linux";
  return "Other";
}

/* ───────────────────────── listening persona ───────────────────────── */

function persona(r: Report, replay: number): Persona {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const traits = [
    { id: "explorer", label: "Exploration", value: clamp(r.discovery.shareOfMinutes / 0.4) },
    { id: "loyalist", label: "Loyalty", value: clamp((r.diversity.top10Share - 0.3) / 0.5) },
    { id: "owl", label: "After dark", value: clamp(r.clock.nightShare / 0.35) },
    { id: "replayer", label: "Replay", value: clamp((replay - 2) / 10) },
    { id: "curator", label: "Intention", value: clamp((r.intent.intentional - 0.1) / 0.4) },
    { id: "purist", label: "Album depth", value: clamp(r.albumRuns.reduce((s, a) => s + a.runs, 0) / 40) },
  ];
  const top = [...traits].sort((a, b) => b.value - a.value)[0];
  const P: Record<string, [string, string]> = {
    explorer: ["The Explorer", "You treat your library like a map with blank spaces. New names keep showing up — and sticking around."],
    loyalist: ["The Loyalist", "You know what you love. A small circle of artists carried most of your hours, and they earned it."],
    owl: ["The Night Owl", "Your music comes alive after dark. The late hours are when you really press play."],
    replayer: ["The Replayer", "When a song hits, you don't let it go. Repeat is less a button and more a lifestyle."],
    curator: ["The Curator", "You pick, you don't drift. Way more of your plays were hand-chosen than left to autoplay."],
    purist: ["The Album Purist", "Shuffle who? You sit with records front to back, the way the artist meant it."],
  };
  return { id: top.id, name: P[top.id][0], blurb: P[top.id][1], traits: traits.map(({ label, value }) => ({ label, value })) };
}

/* ───────────────────────── formatting ───────────────────────── */

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtPct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
export function fmtDay(day: string, withYear = false) {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
}
export function fmtHour(h: number) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s}${h < 12 ? "am" : "pm"}`;
}
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function monthLabel(m: number) {
  return m > 100 ? `${MONTHS[(m % 100) - 1]} '${String(Math.floor(m / 100)).slice(2)}` : MONTHS[m - 1];
}
