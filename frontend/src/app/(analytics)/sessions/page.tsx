"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import StatCard from "@/components/cards/StatCard";
import DataTable from "@/components/tables/DataTable";
import { COLORS } from "@/lib/constants";
import { formatNumber, formatDate } from "@/lib/formatters";

export default function SessionsPage() {
  const [stats, setStats] = useState<any>(null);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [sessions, setSessions] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<any[]>([]);
  const limit = 50;

  useEffect(() => {
    Promise.all([
      api.sessions.stats(),
      api.sessions.distribution(),
      api.sessions.list({ limit, offset }),
    ]).then(([s, d, l]) => { setStats(s); setDistribution(d); setSessions(l); });
  }, [offset]);

  const handleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    const rows = await api.sessions.get(id);
    setExpandedData(rows);
    setExpanded(id);
  };

  const columns = [
    { key: "start_time", label: "Date", render: (r: any) => formatDate(r.start_time.slice(0, 10)) },
    { key: "start_time2", label: "Start", render: (r: any) => r.start_time.slice(11, 16) + " UTC" },
    { key: "duration_ms", label: "Duration", render: (r: any) => `${Math.round(r.duration_ms / 60000)}m` },
    { key: "play_count", label: "Plays", align: "right" as const },
    { key: "top_artist", label: "Top Artist" },
    { key: "platform_family", label: "Platform" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Sessions</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Total Sessions" value={formatNumber(stats.total_sessions)} accent />
          <StatCard label="Avg Duration" value={`${stats.avg_duration_min}m`} />
          <StatCard label="Median Duration" value={`${stats.median_duration_min}m`} />
          <StatCard label="Avg Plays/Session" value={stats.avg_plays} />
          <StatCard label="Longest Session" value={`${stats.longest_session_plays} plays`} sub={formatDate(stats.longest_session_date)} />
        </div>
      )}

      <Section title="Session Length Distribution">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
            <XAxis dataKey="bucket" tick={{ fill: COLORS.textMuted, fontSize: 12 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            <Bar dataKey="count" fill={COLORS.green} radius={[4, 4, 0, 0]} name="Sessions" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="All Sessions">
        <DataTable
          columns={columns as any}
          data={sessions.items}
          rowKey={r => String(r.session_id)}
          onRowClick={r => handleExpand(r.session_id)}
        />
        {expanded !== null && expandedData.length > 0 && (
          <div style={{ background: COLORS.surface2, borderRadius: 8, marginTop: 8, padding: 12 }}>
            <p style={{ color: COLORS.textMuted }} className="text-xs mb-2">Session plays:</p>
            {expandedData.map((p, i) => (
              <div key={i} style={{ color: COLORS.text, fontSize: 13 }} className="py-1 border-b border-zinc-700">
                {p.master_metadata_track_name} — {p.master_metadata_album_artist_name}
                <span style={{ color: COLORS.textMuted }} className="ml-2 text-xs">
                  {Math.round(p.ms_played / 1000)}s
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3 items-center mt-4">
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
            style={{ background: COLORS.surface2, color: offset === 0 ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset === 0 ? "default" : "pointer" }}>← Prev</button>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>{offset + 1}–{Math.min(offset + limit, sessions.total)} of {formatNumber(sessions.total)}</span>
          <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= sessions.total}
            style={{ background: COLORS.surface2, color: offset + limit >= sessions.total ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset + limit >= sessions.total ? "default" : "pointer" }}>Next →</button>
        </div>
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
