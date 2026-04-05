"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import StatCard from "@/components/cards/StatCard";
import DataTable from "@/components/tables/DataTable";
import { COLORS } from "@/lib/constants";
import { formatHours, formatNumber, formatDate, msToHours } from "@/lib/formatters";

export default function PodcastsPage() {
  const [stats, setStats] = useState<any>(null);
  const [shows, setShows] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.podcasts.stats(), api.podcasts.shows({ limit: 100 })]).then(([s, sh]) => {
      setStats(s); setShows(sh); setLoading(false);
    });
  }, []);

  const columns = [
    { key: "show", label: "Show", render: (r: any) => <span style={{ color: COLORS.text, fontWeight: 500 }}>{r.show}</span> },
    { key: "episode_count", label: "Episodes", align: "right" as const },
    { key: "unique_episodes", label: "Unique Eps", align: "right" as const },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: any) => formatHours(msToHours(r.total_ms)) },
    { key: "first_played", label: "Since", align: "right" as const, render: (r: any) => formatDate(r.first_played) },
    { key: "last_played", label: "Last Played", align: "right" as const, render: (r: any) => formatDate(r.last_played) },
  ];

  if (!loading && stats?.total_shows === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div style={{ fontSize: 40 }}>🎙</div>
        <p style={{ color: COLORS.textMuted }}>No podcast data in your history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Podcasts</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Shows" value={formatNumber(stats.total_shows)} accent />
          <StatCard label="Episodes Played" value={formatNumber(stats.total_episodes_played)} />
          <StatCard label="Unique Episodes" value={formatNumber(stats.unique_episodes)} />
          <StatCard label="Listening Hours" value={formatHours(stats.total_hours)} />
        </div>
      )}

      <div style={{ background: COLORS.surface, borderRadius: 12, padding: "20px 24px" }}>
        <h2 style={{ color: COLORS.text }} className="text-base font-semibold mb-4">Shows</h2>
        {loading ? <div style={{ color: COLORS.textMuted }} className="text-center py-8">Loading…</div> : (
          <DataTable columns={columns as any} data={shows.items} rowKey={r => r.show} />
        )}
      </div>
    </div>
  );
}
