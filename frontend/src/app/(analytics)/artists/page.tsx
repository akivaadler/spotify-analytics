"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DataTable from "@/components/tables/DataTable";
import { formatHours, formatNumber, formatPct, formatDate, msToHours } from "@/lib/formatters";
import { COLORS } from "@/lib/constants";
import type { ArtistAgg } from "@/types";

export default function ArtistsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ total: number; items: ArtistAgg[] }>({ total: 0, items: [] });
  const [sortBy, setSortBy] = useState("play_count");
  const [order, setOrder] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [exclude, setExclude] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.artists.list({ sort_by: sortBy, order, limit, offset, exclude_artists: exclude || undefined })
      .then(d => { setData(d); setLoading(false); });
  }, [sortBy, order, offset, exclude]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: "artist", label: "Artist", render: (r: ArtistAgg) => <span style={{ color: COLORS.text, fontWeight: 500 }}>{r.artist}</span> },
    { key: "play_count", label: "Plays", align: "right" as const, render: (r: ArtistAgg) => formatNumber(r.play_count) },
    { key: "total_ms", label: "Time", align: "right" as const, render: (r: ArtistAgg) => formatHours(msToHours(r.total_ms)) },
    { key: "unique_tracks", label: "Tracks", align: "right" as const },
    { key: "unique_albums", label: "Albums", align: "right" as const },
    { key: "skip_rate", label: "Skip Rate", align: "right" as const, render: (r: ArtistAgg) => formatPct(r.skip_rate) },
    { key: "loyalty_score", label: "Loyalty Score", align: "right" as const, render: (r: ArtistAgg) => `${r.loyalty_score}h/yr` },
    { key: "first_played_date", label: "Since", align: "right" as const, render: (r: ArtistAgg) => formatDate(r.first_played_date) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Artists</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Sort by</label>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setOffset(0); }}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
            <option value="play_count">Play Count</option>
            <option value="total_ms">Listening Time</option>
            <option value="unique_tracks">Unique Tracks</option>
            <option value="loyalty_score">Loyalty Score</option>
            <option value="skip_rate">Skip Rate</option>
          </select>
        </div>
        <div>
          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Order</label>
          <select value={order} onChange={e => { setOrder(e.target.value); setOffset(0); }}
            style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">Exclude artist</label>
            <input value={excludeInput} onChange={e => setExcludeInput(e.target.value)} placeholder="Artist name…"
              style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.surface2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, width: 180 }} />
          </div>
          <button onClick={() => { setExclude(excludeInput); setOffset(0); }}
            style={{ background: COLORS.green, color: "#000", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Apply</button>
          {exclude && <button onClick={() => { setExclude(""); setExcludeInput(""); setOffset(0); }}
            style={{ background: COLORS.surface2, color: COLORS.textMuted, borderRadius: 6, padding: "6px 12px", fontSize: 13, border: "none", cursor: "pointer" }}>Clear</button>}
        </div>
      </div>

      <div style={{ background: COLORS.surface, borderRadius: 12 }}>
        {loading ? <div style={{ color: COLORS.textMuted }} className="p-8 text-center">Loading…</div> : (
          <DataTable columns={columns as any} data={data.items} rowKey={r => r.artist}
            onRowClick={r => router.push(`/artists/${encodeURIComponent(r.artist)}`)} />
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
