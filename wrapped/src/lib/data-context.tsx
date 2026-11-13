"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LPlay, Play, Scope } from "./types";
import { localize, defaultTimeZone } from "./localize";
import { clearLibrary, loadLibrary, readLS, saveLibrary, writeLS, type Library } from "./storage";
import { buildReport, yearsIn, type Report } from "./analytics";
import type { MetricViz } from "./sandbox";

export interface CustomMetric {
  id: string;
  prompt: string;
  title: string;
  description: string;
  viz: MetricViz;
  unit: string;
  code: string;
  createdAt: number;
}

interface Ctx {
  status: "loading" | "empty" | "ready";
  library: Library | null;
  plays: LPlay[];
  years: number[];
  scope: Scope;
  setScope: (s: Scope) => void;
  tz: string;
  setTz: (tz: string) => void;
  setLibrary: (plays: Play[], source: Library["source"], files: string[]) => Promise<void>;
  reset: () => Promise<void>;
  report: (scope: Scope) => Report;
  metrics: CustomMetric[];
  saveMetric: (m: CustomMetric) => void;
  deleteMetric: (id: string) => void;
}

const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [library, setLib] = useState<Library | null>(null);
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [tz, setTzState] = useState("UTC");
  const [scope, setScopeState] = useState<Scope>("all");
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);

  useEffect(() => {
    setTzState(readLS("encore.tz", defaultTimeZone()));
    setMetrics(readLS<CustomMetric[]>("encore.metrics", []));
    loadLibrary().then((lib) => {
      setLib(lib);
      setStatus(lib && lib.plays.length ? "ready" : "empty");
    });
  }, []);

  const plays = useMemo(() => (library ? localize(library.plays, tz) : []), [library, tz]);
  const years = useMemo(() => yearsIn(plays), [plays]);

  // Default to the most recent full-ish year once data is ready.
  useEffect(() => {
    if (!years.length) return;
    const saved = readLS<Scope | null>("encore.scope", null);
    if (saved === "all" || (typeof saved === "number" && years.includes(saved))) setScopeState(saved);
    else setScopeState(years[years.length - 1]);
  }, [years]);

  const cache = useMemo(() => new Map<Scope, Report>(), [plays]);
  const report = useCallback(
    (s: Scope) => {
      let r = cache.get(s);
      if (!r) cache.set(s, (r = buildReport(plays, s)));
      return r;
    },
    [cache, plays],
  );

  const value: Ctx = {
    status,
    library,
    plays,
    years,
    scope,
    setScope: (s) => {
      setScopeState(s);
      writeLS("encore.scope", s);
    },
    tz,
    setTz: (t) => {
      setTzState(t);
      writeLS("encore.tz", t);
    },
    setLibrary: async (p, source, files) => {
      const lib: Library = { plays: p, source, files, savedAt: Date.now() };
      setLib(lib);
      setStatus("ready");
      writeLS("encore.scope", null);
      await saveLibrary(lib);
    },
    reset: async () => {
      await clearLibrary();
      setLib(null);
      setStatus("empty");
    },
    report,
    metrics,
    saveMetric: (m) => {
      setMetrics((prev) => {
        const next = [...prev.filter((x) => x.id !== m.id), m];
        writeLS("encore.metrics", next);
        return next;
      });
    },
    deleteMetric: (id) => {
      setMetrics((prev) => {
        const next = prev.filter((x) => x.id !== id);
        writeLS("encore.metrics", next);
        return next;
      });
    },
  };

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData outside provider");
  return c;
}
