"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "@/lib/api";
import { formatHours, formatNumber, formatDate } from "@/lib/formatters";
import StatCard from "@/components/cards/StatCard";
import { COLORS, CHART_COLORS } from "@/lib/constants";
import type { KPIs, YearlySummary, MonthlySummary, DailySummary } from "@/types";
import dynamic from "next/dynamic";

const CalendarHeatmap = dynamic(() => import("@/components/charts/CalendarHeatmap"), { ssr: false });

export default function OverviewPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [yearly, setYearly] = useState<YearlySummary[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [calendar, setCalendar] = useState<DailySummary[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.overview.kpis(),
      api.overview.yearly(),
      api.overview.monthly(),
      api.temporal.calendar(),
      api.meta(),
    ]).then(([k, y, m, c, mt]) => {
      setKpis(k); setYearly(y); setMonthly(m); setCalendar(c); setMeta(mt);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  const contentTypes = meta?.content_type_counts
    ? Object.entries(meta.content_type_counts).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 style={{ color: COLORS.text }} className="text-2xl font-bold mb-1">Overview</h1>
        <p style={{ color: COLORS.textMuted }} className="text-sm">
          {formatDate(kpis?.date_start ?? null)} — {formatDate(kpis?.date_end ?? null)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Listening Hours" value={formatNumber(kpis?.total_hours || 0)} accent />
        <StatCard label="Total Plays" value={formatNumber(kpis?.total_plays || 0)} />
        <StatCard label="Unique Artists" value={formatNumber(kpis?.unique_artists || 0)} />
        <StatCard label="Unique Tracks" value={formatNumber(kpis?.unique_tracks || 0)} />
        <StatCard label="Longest Streak" value={`${kpis?.longest_streak || 0}d`} sub="consecutive days" />
        <StatCard label="Most Active Day" value={`${kpis?.most_active_hours || 0}h`} sub={formatDate(kpis?.most_active_date ?? null)} />
      </div>

      {/* Top artist + track */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="All-time Top Artist" value={kpis?.top_artist || "—"} />
        <StatCard label="All-time Top Track" value={kpis?.top_track || "—"} />
      </div>

      {/* Annual bar chart */}
      <Section title="Listening by Year">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yearly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis dataKey="year" tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }}
              labelStyle={{ color: COLORS.text }}
            />
            <Legend wrapperStyle={{ color: COLORS.textMuted, fontSize: 12 }} />
            <Bar dataKey="plays" fill={COLORS.green} name="Plays" radius={[4, 4, 0, 0]} />
            <Bar dataKey="hours" fill="#509BF5" name="Hours" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Monthly trend */}
      <Section title="Monthly Listening Trend">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis
              dataKey="yearmonth"
              tick={{ fill: COLORS.textMuted, fontSize: 10 }}
              interval={11}
            />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }}
              labelStyle={{ color: COLORS.text }}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke={COLORS.green}
              strokeWidth={2}
              fill="url(#greenGrad)"
              name="Hours"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* Content type donut */}
      {contentTypes.length > 1 && (
        <Section title="Content Type Breakdown">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={contentTypes}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: COLORS.textMuted }}
              >
                {contentTypes.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Calendar heatmap */}
      {calendar.length > 0 && meta && (
        <Section title="Listening Calendar">
          <CalendarHeatmap
            data={calendar}
            startDate={meta.date_start}
            endDate={meta.date_end}
          />
        </Section>
      )}
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

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div style={{ color: COLORS.textMuted }}>Loading…</div>
    </div>
  );
}
