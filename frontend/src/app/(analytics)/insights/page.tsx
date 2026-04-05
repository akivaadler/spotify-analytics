"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, LineChart, Line,
} from "recharts";
import { API_BASE, COLORS } from "@/lib/constants";
import { formatNumber } from "@/lib/formatters";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Insight {
  id: string;
  name: string;
  description: string;
  value: string | number;
  unit: string;
  data: any[] | Record<string, any>;
  data_label: string;
  error?: string;
}

interface QueryResult {
  query: string;
  code: string;
  result: any;
  error: string | null;
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ insight, onClick }: { insight: Insight; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.surface,
        borderRadius: 12,
        padding: "16px 20px",
        cursor: "pointer",
        border: `1px solid transparent`,
        transition: "border-color 0.15s",
      }}
      className="hover:border-green-500 flex flex-col gap-2"
    >
      {insight.error ? (
        <div style={{ color: "#f87171", fontSize: 12 }}>Error: {insight.error}</div>
      ) : (
        <>
          <div style={{ color: COLORS.textMuted }} className="text-xs font-semibold uppercase tracking-wider">
            {insight.name}
          </div>
          <div style={{ color: COLORS.green }} className="text-2xl font-bold leading-tight">
            {typeof insight.value === "number" ? formatNumber(insight.value) : insight.value}
          </div>
          <div style={{ color: COLORS.textMuted }} className="text-xs">{insight.unit}</div>
          <div style={{ color: COLORS.textMuted }} className="text-xs mt-1 line-clamp-2 leading-4">
            {insight.description}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Insight detail drawer ────────────────────────────────────────────────────

function InsightDrawer({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  if (!insight) return null;

  const data = Array.isArray(insight.data) ? insight.data : null;
  const comfortData = !Array.isArray(insight.data) && insight.id === "comfort_gravity" ? insight.data as Record<string, any[]> : null;

  // Determine best chart type
  const isTimeSeries = insight.id === "discovery_velocity";
  const isPie = insight.id === "session_shape";
  const firstRow = data?.[0];
  const numericKey = firstRow
    ? Object.keys(firstRow).find(k => typeof firstRow[k] === "number" && k !== "session_id")
    : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface, borderRadius: "16px 16px 0 0",
          width: "100%", maxWidth: 860, maxHeight: "80vh", overflow: "auto",
          padding: "24px 28px",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 style={{ color: COLORS.text }} className="text-xl font-bold">{insight.name}</h2>
            <p style={{ color: COLORS.textMuted }} className="text-sm mt-1">{insight.description}</p>
          </div>
          <button onClick={onClose} style={{ color: COLORS.muted, fontSize: 24, lineHeight: 1 }} className="ml-4 hover:text-white">×</button>
        </div>

        {/* Headline value */}
        <div style={{ background: COLORS.surface2, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }} className="flex gap-3 items-baseline">
          <span style={{ color: COLORS.green, fontSize: 28, fontWeight: 700 }}>
            {typeof insight.value === "number" ? formatNumber(insight.value) : insight.value}
          </span>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>{insight.unit}</span>
        </div>

        {/* Data label */}
        {insight.data_label && (
          <div style={{ color: COLORS.textMuted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
            {insight.data_label}
          </div>
        )}

        {/* Chart / table */}
        {isTimeSeries && data && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface2} />
              <XAxis dataKey="yearmonth" tick={{ fill: COLORS.textMuted, fontSize: 10 }} interval={11} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
              <Area type="monotone" dataKey="new_artists" stroke={COLORS.green} fill="url(#dg)" name="New artists" />
              <Line type="monotone" dataKey="rolling_avg" stroke="#509BF5" dot={false} name="3mo avg" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {isPie && data && (
          <div className="flex flex-wrap gap-3">
            {data.map((row: any) => (
              <div key={row.shape} style={{ background: COLORS.surface2, borderRadius: 8, padding: "10px 16px" }}>
                <div style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{row.shape}</div>
                <div style={{ color: COLORS.green, fontSize: 20, fontWeight: 700 }}>{row.pct}%</div>
              </div>
            ))}
          </div>
        )}

        {comfortData && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div style={{ color: COLORS.textMuted }} className="text-xs font-semibold mb-2">Passive comfort (drift into)</div>
              {comfortData.passive_comfort?.map((r: any) => (
                <div key={r.artist} style={{ color: COLORS.text, fontSize: 13 }} className="py-1 flex justify-between border-b border-zinc-700">
                  <span>{r.artist}</span>
                  <span style={{ color: COLORS.green }}>{(r.comfort_score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: COLORS.textMuted }} className="text-xs font-semibold mb-2">Active pursuit (deliberately chosen)</div>
              {comfortData.active_pursuit?.map((r: any) => (
                <div key={r.artist} style={{ color: COLORS.text, fontSize: 13 }} className="py-1 flex justify-between border-b border-zinc-700">
                  <span>{r.artist}</span>
                  <span style={{ color: "#509BF5" }}>{(r.comfort_score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isTimeSeries && !isPie && !comfortData && data && data.length > 0 && numericKey && (
          <div>
            <ResponsiveContainer width="100%" height={Math.min(data.length * 28 + 40, 340)}>
              <BarChart data={data.slice(0, 15)} layout="vertical" margin={{ left: 140, right: 20 }}>
                <XAxis type="number" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey={Object.keys(firstRow!)[0]}
                  tick={{ fill: COLORS.text, fontSize: 11 }}
                  width={130}
                />
                <Tooltip contentStyle={{ background: COLORS.surface, border: "none", borderRadius: 8 }} />
                <Bar dataKey={numericKey} fill={COLORS.green} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Raw table below chart */}
            <div style={{ marginTop: 16, maxHeight: 240, overflowY: "auto" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.surface2}` }}>
                    {Object.keys(firstRow!).filter(k => k !== "uri").map(k => (
                      <th key={k} style={{ color: COLORS.textMuted, padding: "6px 8px", textAlign: "left", fontSize: 11, fontWeight: 500 }}>
                        {k.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.surface}` }}>
                      {Object.entries(row).filter(([k]) => k !== "uri").map(([k, v]) => (
                        <td key={k} style={{ color: COLORS.text, padding: "7px 8px" }}>
                          {typeof v === "number" ? (v > 1000 ? formatNumber(v) : v) : String(v ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Custom LLM Query ─────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  "What artist did I actively start playing the most?",
  "Which hour of the day do I listen the most?",
  "What's my most-played song in the last 2 years?",
  "Which artist did I discover most recently?",
  "What's my longest listening session ever?",
  "Which day of the week do I listen the most?",
  "What percentage of my plays are skipped?",
  "Which artists have I never skipped?",
];

function CustomQueryPanel() {
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryResult[]>([]);
  const [showCode, setShowCode] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/insights/custom/status`)
      .then(r => r.json())
      .then(s => setLlmAvailable(s.available));
  }, []);

  const runQuery = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/insights/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data: QueryResult = await res.json();
      setHistory(prev => [data, ...prev]);
      setQuery("");
    } catch (e: any) {
      setHistory(prev => [{ query, code: "", result: null, error: e.message }, ...prev]);
    }
    setLoading(false);
  };

  const renderResult = (result: any) => {
    if (result === null || result === undefined) return null;
    if (typeof result === "string") return (
      <div style={{ color: COLORS.text, padding: "10px 12px", background: COLORS.surface2, borderRadius: 8 }}>{result}</div>
    );
    if (typeof result === "number" || typeof result === "boolean") return (
      <div style={{ color: COLORS.green, fontSize: 28, fontWeight: 700 }}>{String(result)}</div>
    );
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === "object") {
      const keys = Object.keys(result[0]);
      return (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.surface2}` }}>
                {keys.map(k => (
                  <th key={k} style={{ color: COLORS.textMuted, padding: "6px 10px", textAlign: "left", fontSize: 11 }}>
                    {k.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.slice(0, 30).map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.surface}` }}>
                  {keys.map(k => (
                    <td key={k} style={{ color: COLORS.text, padding: "8px 10px" }}>
                      {typeof row[k] === "number" && row[k] > 1000 ? formatNumber(row[k]) : String(row[k] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (typeof result === "object") return (
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(result).slice(0, 30).map(([k, v]) => (
              <tr key={k} style={{ borderBottom: `1px solid ${COLORS.surface}` }}>
                <td style={{ color: COLORS.textMuted, padding: "7px 10px", width: "40%" }}>{k}</td>
                <td style={{ color: COLORS.text, padding: "7px 10px" }}>
                  {typeof v === "number" && v > 1000 ? formatNumber(v) : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    return <pre style={{ color: COLORS.textMuted, fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>;
  };

  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-start justify-between mb-1">
        <h2 style={{ color: COLORS.text }} className="text-base font-semibold">Custom Query</h2>
        <div style={{
          background: llmAvailable ? "#14532d" : COLORS.surface2,
          color: llmAvailable ? "#86efac" : COLORS.muted,
          fontSize: 11, borderRadius: 4, padding: "2px 8px",
        }}>
          {llmAvailable === null ? "…" : llmAvailable ? "LLM Ready" : "No API Key"}
        </div>
      </div>
      <p style={{ color: COLORS.textMuted }} className="text-xs mb-4">
        Ask any question about your listening history in plain English. Claude generates and runs the analysis.
        {!llmAvailable && llmAvailable !== null && (
          <span style={{ color: "#f59e0b" }}>
            {" "}Add your Anthropic API key in{" "}
            <Link href="/settings" style={{ color: COLORS.green, textDecoration: "underline" }}>
              Settings
            </Link>{" "}
            to enable.
          </span>
        )}
      </p>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runQuery()}
          placeholder="e.g. What artist did I actively start the most?"
          disabled={!llmAvailable || loading}
          style={{
            flex: 1, background: COLORS.surface2, color: COLORS.text,
            border: `1px solid ${COLORS.muted}`, borderRadius: 8,
            padding: "10px 14px", fontSize: 14,
            opacity: !llmAvailable ? 0.5 : 1,
          }}
        />
        <button
          onClick={runQuery}
          disabled={!llmAvailable || !query.trim() || loading}
          style={{
            background: llmAvailable && query.trim() && !loading ? COLORS.green : COLORS.surface2,
            color: llmAvailable && query.trim() && !loading ? "#000" : COLORS.muted,
            borderRadius: 8, padding: "10px 20px", fontWeight: 600,
            fontSize: 14, border: "none", cursor: llmAvailable && query.trim() && !loading ? "pointer" : "default",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {/* Example queries */}
      <div className="flex flex-wrap gap-2 mb-6">
        {EXAMPLE_QUERIES.map(q => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            style={{
              background: COLORS.surface2, color: COLORS.textMuted,
              borderRadius: 999, padding: "4px 12px", fontSize: 12,
              border: "none", cursor: "pointer",
            }}
            className="hover:text-white transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Query history */}
      {history.length > 0 && (
        <div className="flex flex-col gap-4">
          {history.map((h, i) => (
            <div key={i} style={{ background: COLORS.surface2, borderRadius: 10, padding: "14px 16px" }}>
              <div className="flex items-start justify-between mb-3">
                <div style={{ color: COLORS.text, fontWeight: 500, fontSize: 14 }}>"{h.query}"</div>
                <button
                  onClick={() => setShowCode(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ color: COLORS.muted, fontSize: 11, marginLeft: 8, whiteSpace: "nowrap" }}
                  className="hover:text-white"
                >
                  {showCode[i] ? "hide code" : "show code"}
                </button>
              </div>

              {showCode[i] && h.code && (
                <pre style={{
                  background: "#0d1117", color: "#c9d1d9", borderRadius: 8,
                  padding: "12px", fontSize: 12, overflowX: "auto", marginBottom: 12,
                }}>
                  {h.code}
                </pre>
              )}

              {h.error ? (
                <div style={{ color: "#f87171", fontSize: 13 }}>Error: {h.error}</div>
              ) : (
                renderResult(h.result)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selected, setSelected] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/insights`)
      .then(r => r.json())
      .then(data => { setInsights(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Insights</h1>
          <p style={{ color: COLORS.textMuted }} className="text-sm mt-1">
            20 non-obvious metrics + ask your own questions in plain English.
          </p>
        </div>
        <Link
          href="/settings"
          style={{
            color: COLORS.textMuted,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            background: COLORS.surface,
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
          className="hover:text-white transition-colors"
        >
          ⚙ Settings
        </Link>
      </div>

      {/* Custom query — top */}
      <CustomQueryPanel />

      {/* Metrics grid */}
      <div>
        <h2 style={{ color: COLORS.textMuted }} className="text-xs font-semibold uppercase tracking-wider mb-3">
          Pre-computed Metrics
        </h2>
        {loading ? (
          <div style={{ color: COLORS.textMuted }} className="text-center py-16">Computing insights…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {insights.map(insight => (
              <MetricCard key={insight.id} insight={insight} onClick={() => setSelected(insight)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && <InsightDrawer insight={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
