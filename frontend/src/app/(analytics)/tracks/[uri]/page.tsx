"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { api } from "@/lib/api";
import StatCard from "@/components/cards/StatCard";
import { COLORS, CHART_COLORS } from "@/lib/constants";
import { formatHours, formatNumber, formatPct, formatDate, msToHours } from "@/lib/formatters";

export default function TrackDetailPage() {
  const { uri } = useParams<{ uri: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (uri) api.tracks.get(decodeURIComponent(uri)).then(setData);
  }, [uri]);

  if (!data) return <div style={{ color: COLORS.textMuted }} className="p-8">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.back()} style={{ color: COLORS.textMuted }} className="text-sm hover:text-white w-fit">← Back</button>

      <div>
        <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">{data.track_name}</h1>
        <p style={{ color: COLORS.textMuted }}>{data.artist} · {data.album}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Plays" value={formatNumber(data.play_count)} accent />
        <StatCard label="Listening Time" value={formatHours(msToHours(data.total_ms))} />
        <StatCard label="Completion" value={formatPct(data.avg_completion)} />
        <StatCard label="Skip Rate" value={formatPct(data.skip_rate)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="First Played" value={formatDate(data.first_played)} />
        <StatCard label="Last Played" value={formatDate(data.last_played)} />
      </div>

      <Section title="Monthly Play History">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.monthly_trend}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis dataKey="yearmonth" tick={{ fill: COLORS.textMuted, fontSize: 10 }} interval={5} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            <Area type="monotone" dataKey="plays" stroke={COLORS.green} strokeWidth={2} fill="url(#g)" name="Plays" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Completion Distribution">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.completion_histogram}>
              <XAxis dataKey="completion_bucket" tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                tickFormatter={v => `${v * 10}–${v * 10 + 10}%`} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
              <Bar dataKey="count" fill={COLORS.green} radius={[4, 4, 0, 0]} name="Plays" />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Platform Breakdown">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.platform_breakdown} dataKey="count" nameKey="platform_family"
                cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {data.platform_breakdown.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>
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
