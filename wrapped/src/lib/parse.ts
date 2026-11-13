import { unzipSync, strFromU8 } from "fflate";
import type { Kind, Play, SpotifyExtendedEntry, SpotifyLegacyEntry } from "./types";

export interface ParseResult {
  plays: Play[];
  files: { name: string; entries: number }[];
  skipped: { name: string; reason: string }[];
}

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function fromExtended(e: SpotifyExtendedEntry): Play | null {
  const ts = Date.parse(e.ts);
  if (!Number.isFinite(ts)) return null;
  let kind: Kind = "other";
  if (e.spotify_track_uri || e.master_metadata_track_name) kind = "track";
  else if (e.spotify_episode_uri || e.episode_name) kind = "episode";
  else if (e.audiobook_uri || e.audiobook_title) kind = "audiobook";
  return {
    ts,
    ms: Math.max(0, Number(e.ms_played) || 0),
    kind,
    track: s(e.master_metadata_track_name),
    artist: s(e.master_metadata_album_artist_name),
    album: s(e.master_metadata_album_album_name),
    uri: s(e.spotify_track_uri) ?? s(e.spotify_episode_uri) ?? s(e.audiobook_chapter_uri),
    show: s(e.episode_show_name) ?? s(e.audiobook_title),
    episode: s(e.episode_name) ?? s(e.audiobook_chapter_title),
    platform: s(e.platform) ?? "unknown",
    country: s(e.conn_country) ?? "ZZ",
    reasonStart: s(e.reason_start) ?? "unknown",
    reasonEnd: s(e.reason_end) ?? "unknown",
    shuffle: !!e.shuffle,
    skipped: !!e.skipped,
    offline: !!e.offline,
    incognito: !!e.incognito_mode,
  };
}

function fromLegacy(e: SpotifyLegacyEntry): Play | null {
  const ts = Date.parse(e.endTime.replace(" ", "T") + ":00Z");
  if (!Number.isFinite(ts)) return null;
  return {
    ts,
    ms: Math.max(0, Number(e.msPlayed) || 0),
    kind: "track",
    track: s(e.trackName),
    artist: s(e.artistName),
    album: null,
    uri: null,
    show: null,
    episode: null,
    platform: "unknown",
    country: "ZZ",
    reasonStart: "unknown",
    reasonEnd: "unknown",
    shuffle: false,
    skipped: false,
    offline: false,
    incognito: false,
  };
}

function parseJsonText(name: string, text: string, out: ParseResult) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    out.skipped.push({ name, reason: "Not valid JSON" });
    return;
  }
  if (!Array.isArray(data) || data.length === 0) {
    out.skipped.push({ name, reason: "Not a list of plays" });
    return;
  }
  const first = data[0] as Record<string, unknown>;
  let n = 0;
  if ("ts" in first && "ms_played" in first) {
    for (const e of data as SpotifyExtendedEntry[]) {
      const p = fromExtended(e);
      if (p) (out.plays.push(p), n++);
    }
  } else if ("endTime" in first && "msPlayed" in first) {
    for (const e of data as SpotifyLegacyEntry[]) {
      const p = fromLegacy(e);
      if (p) (out.plays.push(p), n++);
    }
  } else {
    out.skipped.push({ name, reason: "Doesn't look like Spotify streaming history" });
    return;
  }
  out.files.push({ name, entries: n });
}

/** Parse any mix of .json files and Spotify's .zip download. Runs fully in the browser. */
export async function parseFiles(files: File[]): Promise<ParseResult> {
  const out: ParseResult = { plays: [], files: [], skipped: [] };
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(buf, {
          filter: (fi) => /\.json$/i.test(fi.name) && /stream/i.test(fi.name),
        });
      } catch {
        out.skipped.push({ name: f.name, reason: "Could not open zip" });
        continue;
      }
      for (const [name, bytes] of Object.entries(entries)) {
        parseJsonText(name.split("/").pop() ?? name, strFromU8(bytes), out);
      }
    } else if (lower.endsWith(".json")) {
      parseJsonText(f.name, await f.text(), out);
    } else {
      out.skipped.push({ name: f.name, reason: "Unsupported file type" });
    }
  }
  out.plays = dedupe(out.plays);
  return out;
}

/** Merge + de-duplicate (re-uploading overlapping files is safe). */
export function dedupe(plays: Play[]): Play[] {
  const seen = new Set<string>();
  const res: Play[] = [];
  for (const p of plays) {
    const k = `${p.ts}|${p.uri ?? p.track ?? p.episode}|${p.ms}`;
    if (seen.has(k)) continue;
    seen.add(k);
    res.push(p);
  }
  res.sort((a, b) => a.ts - b.ts);
  return res;
}
