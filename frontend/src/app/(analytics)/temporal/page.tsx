"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import HeatmapChart from "@/components/charts/HeatmapChart";
import StatCard from "@/components/cards/StatCard";
import { COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";
import dynamic from "next/dynamic";

const CalendarHeatmap = dynamic(() => import("@/components/charts/CalendarHeatmap"), { ssr: false });

export default function TemporalPage() {
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [hourly, setHourly] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [tzOffset, setTzOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.temporal.heatmap(tzOffset),
      api.temporal.hourly({ tz_offset: tzOffset }),
      api.temporal.weekly(),
      api.temporal.monthlyPattern(),
      api.temporal.calendar(),
      api.temporal.streaks(),
      api.meta(),
    ]).then(([h, ho, w, m, c, s, mt]) => {
      setHeatmap(h); setHourly(ho); setWeekly(w); setMonthly(m);
      setCalendar(c); setStreaks(s); setMeta(mt);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [tzOffset]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Time Patterns</h1>
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Timezone offset (UTC+)</label>
          <select value={tzOffset} onChange={e => setTzOffset(Number(e.target.value))}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
            {Array.from({ length: 27 }, (_, i) => i - 12).map(o => (
              <option key={o} value={o}>UTC{o >= 0 ? `+${o}` : o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Streak stats */}
      {streaks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Longest Streak" value={`${streaks.max_streak} days`} accent />
          <StatCard label="Streak Dates" value={`${formatDate(streaks.max_streak_start)} – ${formatDate(streaks.max_streak_end)}`} />
          <StatCard label="Current Streak" value={`${streaks.current_streak} days`} />
          <StatCard label="Active Days" value={streaks.total_active_days?.toLocaleString()} sub="total" />
        </div>
      )}

      {/* Heatmap */}
      <Section title="Hour × Day of Week Heatmap">
        {loading ? <div style={{ color: COLORS.textMuted }}>Loading…</div> : <HeatmapChart data={heatmap} />}
      </Section>

      {/* Hourly + Weekly side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Plays by Hour">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
              <XAxis dataKey="hour_local" tick={{ fill: COLORS.textMuted, fontSize: 10 }}
                tickFormatter={h => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
              <Bar dataKey="plays" fill={COLORS.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Plays by Day of Week">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
              <XAxis dataKey="day_name" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
              <Bar dataKey="plays" fill="#509BF5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Seasonal */}
      <Section title="Seasonal Pattern (by calendar month)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis dataKey="month_name" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            <Bar dataKey="plays" fill="#F573A0" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Calendar */}
      {calendar.length > 0 && meta && (
        <Section title="Listening Calendar">
          <CalendarHeatmap data={calendar} startDate={meta.date_start} endDate={meta.date_end} />
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
