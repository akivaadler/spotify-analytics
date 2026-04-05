"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DataTable from "@/components/tables/DataTable";
import { formatHours, formatNumber, formatPct, formatDate, msToHours } from "@/lib/formatters";
import { COLORS } from "@/lib/constants";
import type { TrackAgg } from "@/types";

const SORT_OPTIONS = [
  { value: "play_count", label: "Play Count" },
  { value: "total_ms", label: "Listening Time" },
  { value: "skip_rate", label: "Skip Rate" },
  { value: "avg_completion", label: "Completion %" },
];

export default function TracksPage() {
  const router = useRouter();
  const [data, setData] = useState<{ total: number; items: TrackAgg[] }>({ total: 0, items: [] });
  const [sortBy, setSortBy] = useState("play_count");
  const [order, setOrder] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [exclude, setExclude] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.tracks.list({ sort_by: sortBy, order, limit, offset, exclude_artists: exclude || undefined })
      .then(d => { setData(d); setLoading(false); });
  }, [sortBy, order, offset, exclude]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: "rank", label: "#", sortable: false, render: (_: TrackAgg, i: number) => offset + i + 1 },
    { key: "track_name", label: "Track", render: (r: TrackAgg) => (
      <div>
        <div style={{ color: COLORS.text }} className="font-medium">{r.track_name}</div>
        <div style={{ color: COLORS.textMuted }} className="text-xs">{r.artist}</div>
      </div>
    )},
    { key: "play_count", label: "Plays", align: "right" as const, render: (r: TrackAgg) => formatNumber(r.play_count) },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: TrackAgg) => formatHours(msToHours(r.total_ms)) },
    { key: "avg_completion", label: "Completion", align: "right" as const, render: (r: TrackAgg) => formatPct(r.avg_completion) },
    { key: "skip_rate", label: "Skip Rate", align: "right" as const, render: (r: TrackAgg) => formatPct(r.skip_rate) },
    { key: "first_played", label: "First Played", align: "right" as const, render: (r: TrackAgg) => formatDate(r.first_played) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Tracks</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Sort by</label>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setOffset(0); }}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Order</label>
          <select
            value={order}
            onChange={e => { setOrder(e.target.value); setOffset(0); }}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          >
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Exclude artist</label>
            <input
              value={excludeInput}
              onChange={e => setExcludeInput(e.target.value)}
              placeholder="Artist name…"
              style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, width: 180 }}
            />
          </div>
          <button
            onClick={() => { setExclude(excludeInput); setOffset(0); }}
            style={{ background: COLORS.green, color: "#000", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Apply
          </button>
          {exclude && (
            <button
              onClick={() => { setExclude(""); setExcludeInput(""); setOffset(0); }}
              style={{ background: COLORS.surface2, color: COLORS.textMuted, borderRadius: 6, padding: "6px 12px", fontSize: 13, border: "none", cursor: "pointer" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: COLORS.surface, borderRadius: 12 }}>
        {loading ? (
          <div style={{ color: COLORS.textMuted }} className="p-8 text-center">Loading…</div>
        ) : (
          <DataTable
            columns={columns as any}
            data={data.items}
            rowKey={r => r.spotify_track_uri}
            onRowClick={r => router.push(`/tracks/${encodeURIComponent(r.spotify_track_uri)}`)}
          />
        )}
      </div>

      {/* Pagination */}
      <div className="flex gap-3 items-center">
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0}
          style={{ background: COLORS.surface, color: offset === 0 ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset === 0 ? "default" : "pointer" }}
        >
          ← Prev
        </button>
        <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
          {offset + 1}–{Math.min(offset + limit, data.total)} of {formatNumber(data.total)}
        </span>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={offset + limit >= data.total}
          style={{ background: COLORS.surface, color: offset + limit >= data.total ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset + limit >= data.total ? "default" : "pointer" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
