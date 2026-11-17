/**
 * Turns a row from any ranked metric ("Golden Machine · Velvet Lanterns", an
 * artist name, an album …) into a full profile of that song / artist / album.
 */
import type { LPlay, Scope } from "./types";
import { MONTHS, isSkip, trackKey } from "./analytics";
import { isActive } from "./deep";

export type EntityRef =
  | { kind: "song"; track: string; artist: string }
  | { kind: "artist"; artist: string }
  | { kind: "album"; album: string; artist: string };

const isMusic = (p: LPlay) => p.kind === "track" && !!p.track && !!p.artist && p.ms > 0;

export interface EntityIndex {
  songs: Map<string, Set<string>>; // track -> artists
  artists: Set<string>;
  albums: Map<string, Set<string>>; // album -> artists
}

export function buildIndex(all: LPlay[]): EntityIndex {
  const songs = new Map<string, Set<string>>();
  const artists = new Set<string>();
  const albums = new Map<string, Set<string>>();
  for (const p of all) {
    if (!isMusic(p)) continue;
    (songs.get(p.track!) ?? songs.set(p.track!, new Set()).get(p.track!)!).add(p.artist!);
    artists.add(p.artist!);
    if (p.album) (albums.get(p.album) ?? albums.set(p.album, new Set()).get(p.album)!).add(p.artist!);
  }
  return { songs, artists, albums };
}

/** Best guess at what a metric row refers to. Rows put the artist first in `sub`. */
export function resolve(idx: EntityIndex, label: string, sub?: string): EntityRef | null {
  const s = sub ?? "";
  const lead = s.split(" · ")[0].replace(/^“|”$/g, "");
  const songArtists = idx.songs.get(label);
  if (songArtists) {
    const a = [...songArtists].find((x) => s.startsWith(x) || s.includes(x));
    if (a) return { kind: "song", track: label, artist: a };
  }
  const albumArtists = idx.albums.get(label);
  if (albumArtists) {
    const a = [...albumArtists].find((x) => s.startsWith(x));
    if (a) return { kind: "album", album: label, artist: a };
  }
  if (idx.artists.has(label)) return { kind: "artist", artist: label };
  // e.g. device rows: label = device, sub = “song” · artist
  const quoted = s.match(/“(.+?)”/)?.[1];
  if (quoted && idx.songs.has(quoted)) {
    const a = [...idx.songs.get(quoted)!].find((x) => s.includes(x));
    if (a) return { kind: "song", track: quoted, artist: a };
  }
  if (songArtists && songArtists.size === 1) return { kind: "song", track: label, artist: [...songArtists][0] };
  if (idx.artists.has(lead)) return { kind: "artist", artist: lead };
  return null;
}

export interface EntityProfile {
  ref: EntityRef;
  title: string;
  subtitle: string;
  plays: number;
  minutes: number;
  pickedPct: number;
  skippedPct: number;
  finishedPct: number;
  shufflePct: number;
  first: string | null;
  last: string | null;
  activeDays: number;
  monthly: { label: string; value: number }[]; // whole history, plays per month
  hours: { label: string; value: number }[];
  topSongs: { label: string; sub: string; value: number }[]; // artist / album only
  share: number; // share of your music time in scope
}

const match = (ref: EntityRef) => (p: LPlay) =>
  ref.kind === "song"
    ? p.track === ref.track && p.artist === ref.artist
    : ref.kind === "artist"
      ? p.artist === ref.artist
      : p.album === ref.album && p.artist === ref.artist;

export function profile(all: LPlay[], scope: Scope, ref: EntityRef): EntityProfile {
  const f = match(ref);
  const music = all.filter(isMusic);
  const mine = music.filter(f);
  const inScope = mine.filter((p) => scope === "all" || p.year === scope);
  const scopeMs = music.filter((p) => scope === "all" || p.year === scope).reduce((s, p) => s + p.ms, 0);
  const n = inScope.length || 1;
  const streams = inScope.filter((p) => p.ms >= 30_000);

  // monthly plays across all history (so you can see the whole arc)
  const months = new Map<number, number>();
  for (const p of mine) if (p.ms >= 30_000) months.set(p.year * 12 + p.month - 1, (months.get(p.year * 12 + p.month - 1) ?? 0) + 1);
  const keys = [...months.keys()];
  const monthly: EntityProfile["monthly"] = [];
  if (keys.length) {
    for (let k = Math.min(...keys); k <= Math.max(...keys); k++) {
      monthly.push({ label: `${MONTHS[k % 12]} '${String(Math.floor(k / 12)).slice(2)}`, value: months.get(k) ?? 0 });
    }
  }

  const hours = new Array(24).fill(0);
  for (const p of streams) hours[p.hour]++;

  const songs = new Map<string, { label: string; sub: string; value: number }>();
  if (ref.kind !== "song") {
    for (const p of streams) {
      const k = trackKey(p);
      const v = songs.get(k) ?? { label: p.track!, sub: p.artist!, value: 0 };
      v.value++;
      songs.set(k, v);
    }
  }

  const pc = (k: number) => Math.round((k / n) * 1000) / 10;
  return {
    ref,
    title: ref.kind === "song" ? ref.track : ref.kind === "artist" ? ref.artist : ref.album,
    subtitle: ref.kind === "song" ? ref.artist : ref.kind === "album" ? `Album · ${ref.artist}` : "Artist",
    plays: streams.length,
    minutes: Math.round(inScope.reduce((s, p) => s + p.ms, 0) / 60_000),
    pickedPct: pc(inScope.filter(isActive).length),
    skippedPct: pc(inScope.filter(isSkip).length),
    finishedPct: pc(inScope.filter((p) => p.reasonEnd === "trackdone").length),
    shufflePct: pc(inScope.filter((p) => p.shuffle).length),
    first: mine[0]?.day ?? null,
    last: mine[mine.length - 1]?.day ?? null,
    activeDays: new Set(streams.map((p) => p.dayIndex)).size,
    monthly,
    hours: hours.map((v, h) => ({ label: h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`, value: v })),
    topSongs: [...songs.values()].sort((a, b) => b.value - a.value).slice(0, 10),
    share: scopeMs ? inScope.reduce((s, p) => s + p.ms, 0) / scopeMs : 0,
  };
}
