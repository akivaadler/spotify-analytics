"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import DataTable from "@/components/tables/DataTable";
import { formatHours, formatNumber, formatPct, formatDate, msToHours } from "@/lib/formatters";
import { COLORS } from "@/lib/constants";
import type { AlbumAgg } from "@/types";

export default function AlbumsPage() {
  const [data, setData] = useState<{ total: number; items: AlbumAgg[] }>({ total: 0, items: [] });
  const [sortBy, setSortBy] = useState("play_count");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.albums.list({ sort_by: sortBy, limit, offset }).then(d => { setData(d); setLoading(false); });
  }, [sortBy, offset]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: "album", label: "Album", render: (r: AlbumAgg) => (
      <div>
        <div style={{ color: COLORS.text, fontWeight: 500 }}>{r.album}</div>
        <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{r.artist}</div>
      </div>
    )},
    { key: "play_count", label: "Plays", align: "right" as const, render: (r: AlbumAgg) => formatNumber(r.play_count) },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: AlbumAgg) => formatHours(msToHours(r.total_ms)) },
    { key: "unique_tracks", label: "Tracks", align: "right" as const },
    { key: "skip_rate", label: "Skip Rate", align: "right" as const, render: (r: AlbumAgg) => formatPct(r.skip_rate) },
    { key: "first_played", label: "First Played", align: "right" as const, render: (r: AlbumAgg) => formatDate(r.first_played) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Albums</h1>
      <div className="flex gap-3 items-end">
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Sort by</label>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setOffset(0); }}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
            <option value="play_count">Play Count</option>
            <option value="total_ms">Listening Time</option>
            <option value="unique_tracks">Track Count</option>
          </select>
        </div>
      </div>
      <div style={{ background: COLORS.surface, borderRadius: 12 }}>
        {loading ? <div style={{ color: COLORS.textMuted }} className="p-8 text-center">Loading…</div> : (
          <DataTable columns={columns as any} data={data.items} rowKey={r => `${r.album}_${r.artist}`} />
        )}
      </div>
      <div className="flex gap-3 items-center">
        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
          style={{ background: COLORS.surface, color: offset === 0 ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset === 0 ? "default" : "pointer" }}>← Prev</button>
        <span style={{ color: COLORS.textMuted, fontSize: 13 }}>{offset + 1}–{Math.min(offset + limit, data.total)} of {formatNumber(data.total)}</span>
        <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= data.total}
          style={{ background: COLORS.surface, color: offset + limit >= data.total ? COLORS.muted : COLORS.text, borderRadius: 6, padding: "6px 14px", border: "none", cursor: offset + limit >= data.total ? "default" : "pointer" }}>Next →</button>
      </div>
    </div>
  );
}
