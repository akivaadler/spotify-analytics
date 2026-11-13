import type { LPlay, Play } from "./types";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Offset (ms) of `tz` from UTC for each UTC hour bucket, cached. Handles DST and :30/:45 zones. */
function offsetFinder(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const cache = new Map<number, number>();
  return (ts: number) => {
    const bucket = Math.floor(ts / HOUR);
    let off = cache.get(bucket);
    if (off === undefined) {
      const start = bucket * HOUR;
      const parts: Record<string, number> = {};
      for (const p of fmt.formatToParts(new Date(start))) {
        if (p.type !== "literal") parts[p.type] = Number(p.value);
      }
      const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
      off = localAsUtc - start;
      cache.set(bucket, off);
    }
    return off;
  };
}

export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const pad = (n: number) => (n < 10 ? "0" + n : "" + n);

export function localize(plays: Play[], tz: string): LPlay[] {
  let off: (ts: number) => number;
  try {
    off = offsetFinder(tz);
  } catch {
    off = () => 0;
  }
  const out: LPlay[] = new Array(plays.length);
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i];
    const lt = p.ts + off(p.ts);
    const d = new Date(lt);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    out[i] = {
      ...p,
      year: y,
      month: m,
      day: `${y}-${pad(m)}-${pad(dd)}`,
      hour: d.getUTCHours(),
      dow: (d.getUTCDay() + 6) % 7,
      dayIndex: Math.floor(lt / DAY),
    };
  }
  return out;
}
