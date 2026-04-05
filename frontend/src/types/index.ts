export interface KPIs {
  total_plays: number;
  total_plays_valid: number;
  total_hours: number;
  total_days: number;
  unique_tracks: number;
  unique_artists: number;
  unique_albums: number;
  unique_shows: number;
  date_start: string;
  date_end: string;
  span_days: number;
  active_days: number;
  activity_density_pct: number;
  top_artist: string | null;
  top_track: string | null;
  most_active_date: string | null;
  most_active_hours: number;
  longest_streak: number;
  current_streak: number;
}

export interface YearlySummary {
  year: number;
  plays: number;
  hours: number;
  unique_tracks: number;
  unique_artists: number;
}

export interface MonthlySummary {
  yearmonth: string;
  plays: number;
  hours: number;
  unique_tracks: number;
}

export interface DailySummary {
  date: string;
  plays: number;
  hours: number;
}

export interface TrackAgg {
  spotify_track_uri: string;
  track_name: string;
  artist: string;
  album: string;
  play_count: number;
  total_ms: number;
  skip_rate: number;
  avg_completion: number;
  first_played: string;
  last_played: string;
}

export interface ArtistAgg {
  artist: string;
  play_count: number;
  total_ms: number;
  unique_tracks: number;
  unique_albums: number;
  skip_rate: number;
  first_played_date: string;
  last_played_date: string;
  loyalty_score: number;
}

export interface AlbumAgg {
  album: string;
  artist: string;
  play_count: number;
  total_ms: number;
  unique_tracks: number;
  skip_rate: number;
  first_played: string;
}

export interface HeatmapCell {
  hour_local: number;
  dow: number;
  count: number;
  total_ms: number;
}

export interface SessionStats {
  total_sessions: number;
  avg_duration_min: number;
  median_duration_min: number;
  avg_plays: number;
  longest_session_plays: number;
  longest_session_date: string;
}

export interface ShowAgg {
  show: string;
  episode_count: number;
  unique_episodes: number;
  total_ms: number;
  first_played: string;
  last_played: string;
}

export interface StreakData {
  max_streak: number;
  max_streak_start: string;
  max_streak_end: string;
  current_streak: number;
  total_active_days: number;
}

export interface WrappedData {
  year: number;
  total_hours: number;
  total_plays: number;
  new_artists_discovered: number;
  personality: string;
  top_artists: Array<{ artist: string; play_count: number; rank: number }>;
  top_tracks: Array<{ track_name: string; artist: string; play_count: number; rank: number }>;
}

export interface Meta {
  date_start: string;
  date_end: string;
  years_available: number[];
  content_type_counts: Record<string, number>;
  platform_counts: Record<string, number>;
}

export interface AppStatus {
  state: "idle" | "processing" | "ready";
  progress_pct: number;
  records_loaded: number;
  error: string | null;
}
