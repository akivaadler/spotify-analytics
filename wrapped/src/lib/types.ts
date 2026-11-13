/**
 * Raw shape of one entry in Spotify's Extended Streaming History export
 * (Streaming_History_Audio_*.json / Streaming_History_Video_*.json).
 * Every file is a JSON array of these objects.
 */
export interface SpotifyExtendedEntry {
  ts: string; // ISO-8601 UTC, when playback ENDED, e.g. "2024-03-01T18:22:05Z"
  platform?: string | null; // "ios", "android", "windows", "Partner ..." etc.
  ms_played: number;
  conn_country?: string | null; // ISO country code
  ip_addr?: string | null; // never stored by this app
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  audiobook_chapter_uri?: string | null;
  audiobook_chapter_title?: string | null;
  reason_start?: string | null; // "trackdone" | "clickrow" | "fwdbtn" | "backbtn" | "playbtn" | "appload" | "remote" | ...
  reason_end?: string | null; // "trackdone" | "fwdbtn" | "endplay" | "logout" | "backbtn" | ...
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  offline_timestamp?: number | null;
  incognito_mode?: boolean | null;
}

/** Legacy "Account data" export (StreamingHistory_music_0.json etc.). */
export interface SpotifyLegacyEntry {
  endTime: string; // "2023-01-05 21:14" UTC
  artistName: string;
  trackName: string;
  msPlayed: number;
}

export type Kind = "track" | "episode" | "audiobook" | "other";

/** Compact, normalised play record kept in the browser. */
export interface Play {
  ts: number; // epoch ms (UTC) when playback ended
  ms: number; // ms played
  kind: Kind;
  track: string | null;
  artist: string | null;
  album: string | null;
  uri: string | null; // track / episode / chapter URI
  show: string | null; // podcast show or audiobook title
  episode: string | null; // episode or chapter title
  platform: string;
  country: string;
  reasonStart: string;
  reasonEnd: string;
  shuffle: boolean;
  skipped: boolean;
  offline: boolean;
  incognito: boolean;
}

/** A play with local-time fields resolved for the chosen time zone. */
export interface LPlay extends Play {
  year: number;
  month: number; // 1-12
  day: string; // "YYYY-MM-DD" local
  hour: number; // 0-23 local
  dow: number; // 0 = Monday ... 6 = Sunday
  dayIndex: number; // days since epoch (local), handy for streaks
}

export type Scope = number | "all";
