import { API_BASE } from "./constants";
import type {
  KPIs, YearlySummary, MonthlySummary, DailySummary,
  TrackAgg, ArtistAgg, AlbumAgg, HeatmapCell, SessionStats,
  ShowAgg, StreakData, WrappedData, Meta, AppStatus,
} from "@/types";

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  status: () => get<AppStatus>("/api/status"),
  health: () => get<{ status: string; data_loaded: boolean }>("/api/health"),
  meta: () => get<Meta>("/api/meta"),

  overview: {
    kpis: () => get<KPIs>("/api/overview/kpis"),
    yearly: () => get<YearlySummary[]>("/api/overview/yearly"),
    monthly: (params?: { year_from?: number; year_to?: number }) =>
      get<MonthlySummary[]>("/api/overview/monthly", params),
    wrapped: (year: number) => get<WrappedData>(`/api/overview/wrapped/${year}`),
  },

  tracks: {
    list: (params?: {
      year_from?: number; year_to?: number;
      sort_by?: string; order?: string;
      limit?: number; offset?: number; exclude_artists?: string;
    }) => get<{ total: number; items: TrackAgg[] }>("/api/tracks", params),
    get: (uri: string) => get<TrackAgg & { monthly_trend: any[]; completion_histogram: any[]; platform_breakdown: any[] }>(`/api/tracks/${encodeURIComponent(uri)}`),
    history: (uri: string, params?: { year_from?: number; year_to?: number }) =>
      get<any[]>(`/api/tracks/${encodeURIComponent(uri)}/history`, params),
  },

  artists: {
    list: (params?: {
      year_from?: number; year_to?: number;
      sort_by?: string; order?: string;
      limit?: number; offset?: number; exclude_artists?: string;
    }) => get<{ total: number; items: ArtistAgg[] }>("/api/artists", params),
    get: (name: string) => get<any>(`/api/artists/${encodeURIComponent(name)}`),
    timeline: (name: string) => get<any[]>(`/api/artists/${encodeURIComponent(name)}/timeline`),
    tracks: (name: string, params?: { sort_by?: string; limit?: number }) =>
      get<TrackAgg[]>(`/api/artists/${encodeURIComponent(name)}/tracks`, params),
  },

  albums: {
    list: (params?: { sort_by?: string; order?: string; limit?: number; offset?: number }) =>
      get<{ total: number; items: AlbumAgg[] }>("/api/albums", params),
    get: (name: string, artist?: string) =>
      get<any>(`/api/albums/${encodeURIComponent(name)}`, artist ? { artist } : undefined),
  },

  temporal: {
    heatmap: (tz_offset?: number) => get<HeatmapCell[]>("/api/temporal/heatmap", tz_offset !== undefined ? { tz_offset } : undefined),
    calendar: (params?: { year_from?: number; year_to?: number }) =>
      get<DailySummary[]>("/api/temporal/calendar", params),
    hourly: (params?: { tz_offset?: number; year_from?: number; year_to?: number }) =>
      get<any[]>("/api/temporal/hourly", params),
    weekly: (params?: { year_from?: number; year_to?: number }) =>
      get<any[]>("/api/temporal/weekly", params),
    monthlyPattern: (params?: { year_from?: number; year_to?: number }) =>
      get<any[]>("/api/temporal/monthly-pattern", params),
    streaks: () => get<StreakData>("/api/temporal/streaks"),
  },

  sessions: {
    list: (params?: { year_from?: number; year_to?: number; limit?: number; offset?: number }) =>
      get<{ total: number; items: any[] }>("/api/sessions", params),
    stats: () => get<SessionStats>("/api/sessions/stats"),
    distribution: () => get<any[]>("/api/sessions/distribution"),
    get: (id: number) => get<any[]>(`/api/sessions/${id}`),
  },

  podcasts: {
    stats: () => get<any>("/api/podcasts/stats"),
    shows: (params?: { sort_by?: string; limit?: number; offset?: number }) =>
      get<{ total: number; items: ShowAgg[] }>("/api/podcasts/shows", params),
    show: (name: string) => get<any>(`/api/podcasts/shows/${encodeURIComponent(name)}`),
  },

  devices: {
    list: () => get<any>("/api/devices"),
    timeline: (params?: { year_from?: number; year_to?: number }) =>
      get<any[]>("/api/devices/timeline", params),
  },

  search: (q: string) => get<{ tracks: any[]; artists: any[]; albums: any[]; shows: any[] }>("/api/search", { q }),
};
