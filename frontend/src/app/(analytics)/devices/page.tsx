"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import DataTable from "@/components/tables/DataTable";
import { COLORS, CHART_COLORS } from "@/lib/constants";
import { formatHours, formatNumber, formatDate, msToHours } from "@/lib/formatters";

export default function DevicesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.devices.list().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: COLORS.textMuted }} className="p-8 text-center">Loading…</div>;

  const deviceColumns = [
    { key: "platform_family", label: "Platform" },
    { key: "device_label", label: "Device" },
    { key: "play_count", label: "Plays", align: "right" as const, render: (r: any) => formatNumber(r.play_count) },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: any) => formatHours(msToHours(r.total_ms)) },
    { key: "first_active", label: "First Active", align: "right" as const, render: (r: any) => formatDate(r.first_active) },
    { key: "last_active", label: "Last Active", align: "right" as const, render: (r: any) => formatDate(r.last_active) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Devices</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Platform Share">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.platforms} dataKey="play_count" nameKey="platform_family"
                cx="50%" cy="50%" outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {data.platforms.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Top Artists by Platform">
          {Object.entries(data.top_artists_by_platform).map(([platform, artists]: [string, any]) => (
            <div key={platform} className="mb-4">
              <div style={{ color: COLORS.textMuted }} className="text-xs font-semibold uppercase mb-1">{platform}</div>
              {artists.slice(0, 3).map((a: any) => (
                <div key={a.artist} style={{ color: COLORS.text }} className="text-sm py-0.5">
                  {a.artist} <span style={{ color: COLORS.textMuted }}>— {formatHours(msToHours(a.total_ms))}</span>
                </div>
              ))}
            </div>
          ))}
        </Section>
      </div>

      <Section title="All Devices">
        <DataTable
          columns={deviceColumns as any}
          data={data.devices}
          rowKey={r => `${r.platform_family}_${r.device_label}`}
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
