"use client";
import { COLORS, DOW_NAMES } from "@/lib/constants";
import type { HeatmapCell } from "@/types";

interface Props {
  data: HeatmapCell[];
  metric?: "count" | "ms";
}

export default function HeatmapChart({ data, metric = "count" }: Props) {
  if (!data.length) return null;

  const values = data.map(d => metric === "count" ? d.count : d.total_ms);
  const maxVal = Math.max(...values, 1);

  const cellMap: Record<string, HeatmapCell> = {};
  data.forEach(d => { cellMap[`${d.hour_local}_${d.dow}`] = d; });

  const cellSize = 22;
  const leftPad = 36;
  const topPad = 20;
  const width = leftPad + 7 * cellSize + 7 * 2;
  const height = topPad + 24 * cellSize + 24 * 2;

  const colorForVal = (val: number) => {
    if (val === 0) return COLORS.surface;
    const t = Math.sqrt(val / maxVal);
    const r = Math.round(29 * (1 - t) + 29 * t);
    const g = Math.round(40 * (1 - t) + 185 * t);
    const b = Math.round(40 * (1 - t) + 84 * t);
    return `rgba(${r},${g},${b},${0.2 + 0.8 * t})`;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height} style={{ fontFamily: "inherit" }}>
        {/* DOW headers */}
        {DOW_NAMES.map((name, dow) => (
          <text
            key={dow}
            x={leftPad + dow * (cellSize + 2) + cellSize / 2}
            y={topPad - 6}
            textAnchor="middle"
            fontSize={9}
            fill={COLORS.textMuted}
          >
            {name}
          </text>
        ))}

        {/* Hour labels */}
        {Array.from({ length: 24 }, (_, h) => (
          <text
            key={h}
            x={leftPad - 6}
            y={topPad + h * (cellSize + 2) + cellSize / 2 + 4}
            textAnchor="end"
            fontSize={9}
            fill={COLORS.textMuted}
          >
            {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
          </text>
        ))}

        {/* Cells */}
        {Array.from({ length: 24 }, (_, h) =>
          Array.from({ length: 7 }, (_, dow) => {
            const cell = cellMap[`${h}_${dow}`];
            const val = cell ? (metric === "count" ? cell.count : cell.total_ms) : 0;
            return (
              <rect
                key={`${h}_${dow}`}
                x={leftPad + dow * (cellSize + 2)}
                y={topPad + h * (cellSize + 2)}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={colorForVal(val)}
              >
                <title>
                  {DOW_NAMES[dow]} {h}:00 — {val} plays
                </title>
              </rect>
            );
          })
        )}
      </svg>
    </div>
  );
}
