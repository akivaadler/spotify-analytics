"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import StatCard from "@/components/cards/StatCard";
import DataTable from "@/components/tables/DataTable";
import { COLORS } from "@/lib/constants";
import { formatHours, formatNumber, formatPct, formatDate, msToHours } from "@/lib/formatters";

export default function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (id) api.artists.get(decodeURIComponent(id)).then(setData);
  }, [id]);

  if (!data) return <div style={{ color: COLORS.textMuted }} className="p-8">Loading…</div>;

  const trackColumns = [
    { key: "track_name", label: "Track", render: (r: any) => <span style={{ color: COLORS.text }}>{r.track_name}</span> },
    { key: "play_count", label: "Plays", align: "right" as const, render: (r: any) => formatNumber(r.play_count) },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: any) => formatHours(msToHours(r.total_ms)) },
    { key: "avg_completion", label: "Completion", align: "right" as const, render: (r: any) => formatPct(r.avg_completion) },
    { key: "skip_rate", label: "Skip Rate", align: "right" as const, render: (r: any) => formatPct(r.skip_rate) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.back()} style={{ color: COLORS.textMuted }} className="text-sm hover:text-white w-fit">← Back</button>
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">{data.artist}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Plays" value={formatNumber(data.play_count)} accent />
        <StatCard label="Listening Time" value={formatHours(msToHours(data.total_ms))} />
        <StatCard label="Unique Tracks" value={formatNumber(data.unique_tracks)} />
        <StatCard label="Loyalty Score" value={`${data.loyalty_score}h/yr`} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Skip Rate" value={`${data.skip_rate_pct}%`} />
        <StatCard label="Shuffle Rate" value={`${data.shuffle_rate_pct}%`} />
        <StatCard label="Offline Rate" value={`${data.offline_rate_pct}%`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="First Played" value={formatDate(data.first_played_date)} />
        <StatCard label="Last Played" value={formatDate(data.last_played_date)} />
      </div>

      <Section title="Listening Over Time">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.yoy}>
            <defs>
              <linearGradient id="artistGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis dataKey="year" tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            <Area type="monotone" dataKey="plays" stroke={COLORS.green} strokeWidth={2} fill="url(#artistGrad)" name="Plays" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Top Tracks">
        <DataTable
          columns={trackColumns as any}
          data={data.top_tracks}
          rowKey={r => r.spotify_track_uri}
          onRowClick={r => router.push(`/tracks/${encodeURIComponent(r.spotify_track_uri)}`)}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, padding: "20px 24px" }}>
      <h2 style={{ color: COLORS.text }} className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}
