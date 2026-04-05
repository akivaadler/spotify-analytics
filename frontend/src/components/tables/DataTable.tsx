"use client";
import { useState } from "react";
import { COLORS } from "@/lib/constants";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  rowKey: (row: T) => string;
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, defaultSort, defaultOrder = "desc", rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSort);
  const [order, setOrder] = useState<"asc" | "desc">(defaultOrder);

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const diff = av < bv ? -1 : av > bv ? 1 : 0;
    return order === "desc" ? -diff : diff;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) setOrder(o => (o === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setOrder("desc"); }
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLORS.surface2}` }}>
            {columns.map(col => (
              <th
                key={String(col.key)}
                onClick={() => col.sortable !== false && toggleSort(String(col.key))}
                style={{
                  color: COLORS.textMuted,
                  textAlign: col.align || "left",
                  padding: "8px 12px",
                  cursor: col.sortable !== false ? "pointer" : "default",
                  userSelect: "none",
                  fontWeight: 500,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
                {sortKey === String(col.key) && (
                  <span style={{ marginLeft: 4 }}>{order === "desc" ? "↓" : "↑"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: `1px solid ${COLORS.surface}`,
                cursor: onRowClick ? "pointer" : "default",
                background: i % 2 === 0 ? "transparent" : COLORS.surface + "44",
              }}
              className="hover:opacity-80 transition-opacity"
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  style={{
                    padding: "10px 12px",
                    color: COLORS.text,
                    textAlign: col.align || "left",
                  }}
                >
                  {col.render ? col.render(row) : row[String(col.key)] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
