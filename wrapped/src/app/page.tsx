"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/lib/data-context";
import { Uploader } from "@/components/Uploader";
import { Blob, Nav, Rings, Starburst, Squiggle } from "@/components/ui";
import { fmtInt } from "@/lib/analytics";

const FEATURES = [
  { t: "Fair top 5", d: "Your top songs with one per album, so one record can't take every slot.", c: "bg-lime text-ink" },
  { t: "Obsession detector", d: "The song you played most in any 7-day stretch, and when it happened.", c: "bg-pink text-ink" },
  { t: "Comebacks", d: "Songs you came back to after more than a year away.", c: "bg-violet text-cream" },
  { t: "Love / hate", d: "The song you play all the time and also skip all the time.", c: "bg-orange text-ink" },
  { t: "Listening persona", d: "Six traits from how you actually listen, not just what you play.", c: "bg-sky text-ink" },
  { t: "Make your own metric", d: "Describe any stat in plain English. AI writes it and adds it to your dashboard.", c: "bg-yellow text-ink" },
];

export default function Home() {
  const { status, library, plays, years, reset, tz, setTz } = useData();
  const [replacing, setReplacing] = useState(false);

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Nav />
      <main className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {/* hero */}
        <section className="relative pt-12 sm:pt-20">
          <Starburst className="pointer-events-none absolute -right-16 -top-6 w-48 animate-spin-slow opacity-90 sm:w-72" color="#ff4fb8" />
          <Blob className="pointer-events-none absolute -left-24 top-48 w-64 animate-float opacity-80" color="#6b3bff" />
          <h1 className="font-display relative animate-rise text-[clamp(3.4rem,13vw,10rem)] font-extrabold">
            Your year,
            <br />
            <span className="text-lime">louder.</span>
          </h1>
          <p className="d2 relative mt-6 max-w-xl animate-rise text-lg text-cream/80 sm:text-xl">
            Your yearly music recap, with deeper stats. Load your Spotify history and get a story, a dashboard of more than 25 metrics, and a lab where you can describe your own.
          </p>
        </section>

        {status === "loading" && <div className="mt-16 h-40 animate-pulse rounded-[2rem] bg-white/5" />}

        {status === "empty" && (
          <section className="d3 relative mt-12 animate-rise">
            <Uploader />
          </section>
        )}

        {status === "ready" && library && (
          <section className="d3 relative mt-12 animate-rise">
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/story" className="group relative overflow-hidden rounded-[2rem] bg-lime p-7 text-ink transition hover:-rotate-1 md:col-span-2 md:row-span-2 md:p-10">
                <Rings className="absolute -bottom-20 -right-20 w-80 opacity-25 transition group-hover:rotate-45" color="#0d0d10" />
                <p className="text-sm font-bold uppercase tracking-widest">Ready when you are</p>
                <p className="font-display mt-3 text-6xl font-extrabold sm:text-8xl">Play your story ▶</p>
                <p className="mt-4 max-w-md text-lg font-medium">
                  {fmtInt(plays.length)} plays from {years[0]}–{years[years.length - 1]}
                  {library.source === "demo" && " (demo data)"}.
                </p>
              </Link>
              <Link href="/dashboard" className="group rounded-[2rem] bg-pink p-7 text-ink transition hover:rotate-1">
                <p className="font-display text-4xl font-extrabold">Dashboard →</p>
                <p className="mt-2 font-medium">Every metric, with filters you can change.</p>
              </Link>
              <Link href="/lab" className="group rounded-[2rem] bg-violet p-7 text-cream transition hover:-rotate-1">
                <p className="font-display text-4xl font-extrabold">Metric Lab →</p>
                <p className="mt-2 font-medium text-cream/85">Ask for any stat in plain English.</p>
              </Link>
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] bg-white/[0.04] p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-cream/70">
                {library.source === "demo" ? (
                  <>You&apos;re looking at <b className="text-cream">made-up demo data</b>. Load your real files to see your own.</>
                ) : (
                  <>Loaded from {library.files.length} file{library.files.length === 1 ? "" : "s"}. It&apos;s stored only in this browser.</>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-cream/70">
                  Time zone
                  <select value={tz} onChange={(e) => setTz(e.target.value)} className="max-w-48 rounded-full bg-ink-3 px-3 py-1.5 text-cream">
                    {timeZones(tz).map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => setReplacing((v) => !v)} className="rounded-full bg-cream px-4 py-1.5 font-semibold text-ink">
                  {library.source === "demo" ? "Load my files" : "Replace files"}
                </button>
                <button onClick={reset} className="rounded-full border border-white/20 px-4 py-1.5 font-semibold text-cream/80 hover:border-red hover:text-red">
                  Clear data
                </button>
              </div>
            </div>
            {replacing && (
              <div className="mt-4">
                <Uploader compact />
              </div>
            )}
          </section>
        )}

        {/* marquee */}
        <div className="relative -mx-4 mt-20 overflow-hidden border-y border-white/10 py-4 sm:-mx-6">
          <div className="flex w-max animate-marquee gap-10 font-display text-3xl font-extrabold text-cream/80">
            {[...Array(2)].flatMap((_, k) =>
              ["obsessions", "comebacks", "night owl hours", "love/hate songs", "album runs", "streaks", "rising artists", "quiet favorites", "your own metrics"].map((w) => (
                <span key={`${k}-${w}`} className="flex items-center gap-10">
                  {w} <span className="text-pink">✦</span>
                </span>
              )),
            )}
          </div>
        </div>

        {/* features */}
        <section className="mt-20">
          <h2 className="font-display text-5xl font-extrabold sm:text-6xl">
            More than a <span className="text-pink">top 5.</span>
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.t} className={`rounded-[1.75rem] p-6 ${f.c} ${i % 2 ? "sm:rotate-1" : "sm:-rotate-1"}`}>
                <p className="font-display text-3xl font-extrabold">{f.t}</p>
                <p className="mt-2 font-medium opacity-85">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how-to */}
        <section className="relative mt-24 grid gap-8 rounded-[2rem] bg-ink-2 p-7 sm:p-10 md:grid-cols-[1fr_1.3fr]">
          <Squiggle className="absolute -top-6 right-8 w-40" color="#d4ff3a" />
          <h2 className="font-display text-4xl font-extrabold sm:text-5xl">How to get your data</h2>
          <ol className="space-y-4 text-cream/80">
            {[
              <>Go to <b className="text-cream">spotify.com/account/privacy</b> while signed in.</>,
              <>Check <b className="text-cream">“Extended streaming history”</b> and request it. You need this one, not just “Account data”.</>,
              <>Confirm the email. Spotify sends a download link, usually within a few days and at most about 30.</>,
              <>Download <b className="text-cream">my_spotify_data.zip</b> and drop it here, either the whole zip or the JSON files inside it.</>,
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-lg font-extrabold text-ink">{i + 1}</span>
                <span className="pt-1.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 text-center text-xs text-cream/40">
          encore is an independent fan project and isn&apos;t affiliated with or endorsed by Spotify.
        </footer>
      </main>
    </div>
  );
}

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    /* ignore */
  }
  if (!zones.includes("UTC")) zones.unshift("UTC");
  if (!zones.includes(current)) zones.unshift(current);
  return zones;
}
