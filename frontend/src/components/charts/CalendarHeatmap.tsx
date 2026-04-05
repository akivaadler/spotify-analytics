"use client";
import ReactCalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import type { DailySummary } from "@/types";
import { COLORS } from "@/lib/constants";

interface Props {
  data: DailySummary[];
  startDate: string;
  endDate: string;
}

export default function CalendarHeatmap({ data, startDate, endDate }: Props) {
  const maxHours = Math.max(...data.map(d => d.hours), 1);

  const classForValue = (value: any) => {
    if (!value || !value.hours) return "color-empty";
    const t = value.hours / maxHours;
    if (t < 0.25) return "color-scale-1";
    if (t < 0.5) return "color-scale-2";
    if (t < 0.75) return "color-scale-3";
    return "color-scale-4";
  };

  return (
    <>
      <style>{`
        .react-calendar-heatmap .color-empty { fill: ${COLORS.surface2}; }
        .react-calendar-heatmap .color-scale-1 { fill: #0e4429; }
        .react-calendar-heatmap .color-scale-2 { fill: #006d32; }
        .react-calendar-heatmap .color-scale-3 { fill: #26a641; }
        .react-calendar-heatmap .color-scale-4 { fill: ${COLORS.green}; }
        .react-calendar-heatmap text { fill: ${COLORS.textMuted}; font-size: 9px; }
      `}</style>
      <ReactCalendarHeatmap
        startDate={new Date(startDate)}
        endDate={new Date(endDate)}
        values={data.map(d => ({ date: d.date, hours: d.hours, plays: d.plays }))}
        classForValue={classForValue}
        titleForValue={(v: any) => v ? `${v.date}: ${v.plays} plays (${v.hours.toFixed(1)}h)` : "No data"}
        showWeekdayLabels
      />
    </>
  );
}
