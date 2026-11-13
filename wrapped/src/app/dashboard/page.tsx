"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData, type CustomMetric } from "@/lib/data-context";
import { Clock, HBars, Meter, Nav, ScopePicker, VBars } from "@/components/ui";
import { Uploader } from "@/components/Uploader";
import { MetricView } from "@/components/MetricView";
import { sandbox, type MetricOutput } from "@/lib/sandbox";
import {
  DOWS,
  fmtDay,
  fmtHour,
  fmtInt,
  fmtPct,
  inScope,
  isMusic,
  monthLabel,
  rankTracks,
  trackTable,
  type RankOptions,
} from "@/lib/analytics";

function Card({
  title,
  hint,
  accent = "bg-lime",
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  accent?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-[1.75rem] bg-ink-2 p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex items-start gap-3">
        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${accent}`} />
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-extrabold">{title}</h3>
          {hint && <p className="mt-0.5 text-sm text-cream/55">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, color = "text-cream" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-[1.5rem] bg-ink-2 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-cream/55">{label}</p>
      <p className={`font-display mt-2 text-4xl font-extrabold sm:text-5xl ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-cream/55">{sub}</p>}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${on ? "border-lime bg-lime text-ink" : "border-white/15 text-cream/70 hover:border-white/40"}`}
    >
      {children}
    </button>
  );
}

const min = (ms: number) => ms / 60_000;

export default function Dashboard() {
  const { status, scope, report, plays, metrics, deleteMetric } = useData();
  const [opt, setOpt] = useState<RankOptions>({ by: "plays", onePerAlbum: true, onePerArtist: false, n: 10 });

  const r = useMemo(() => (status === "ready" ? report(scope) : null), [status, report, scope]);
  const rows = useMemo(() => trackTable(plays.filter((p) => inScope(p, scope) && isMusic(p) && p.ms > 0)), [plays, scope]);
  const ranked = useMemo(() => rankTracks(rows, opt), [rows, opt]);

  if (status === "loading") return <div className="min-h-dvh" />;
  if (status === "empty" || !r)
    return (
      <div className="min-h-dvh">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-display mb-8 text-5xl font-extrabold">First, your data.</h1>
          <Uploader />
        </main>
      </div>
    );

  const s = r.summary;

  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-display text-6xl font-extrabold sm:text-7xl">
            {r.label}
            <span className="text-lime">.</span>
          </h1>
          <div className="md:max-w-[60%]">
            <ScopePicker />
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Minutes" value={fmtInt(s.minutes)} sub={`${(s.minutes / 1440).toFixed(1)} days`} color="text-lime" />
          <Stat label="Streams" value={fmtInt(s.streams)} sub="30 seconds or longer" />
          <Stat label="Songs" value={fmtInt(s.tracks)} sub={`${fmtInt(s.albums)} albums`} />
          <Stat label="Artists" value={fmtInt(s.artists)} sub={`acts like ${r.diversity.effectiveArtists.toFixed(0)} equally loved`} color="text-pink" />
          <Stat label="Active days" value={fmtInt(s.activeDays)} sub={`of ${fmtInt(s.spanDays)} · ${fmtInt(s.avgPerActiveDay)} min/day`} />
          <Stat label="Variety" value={`${r.diversity.score}`} sub="out of 100" color="text-sky" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* top songs with rules */}
          <Card title="Top songs" hint="Choose your own ranking rules." accent="bg-lime" className="lg:col-span-2">
            <div className="mb-5 flex flex-wrap gap-2">
              <Toggle on={opt.by === "plays"} onClick={() => setOpt({ ...opt, by: "plays" })}>By plays</Toggle>
              <Toggle on={opt.by === "minutes"} onClick={() => setOpt({ ...opt, by: "minutes" })}>By minutes</Toggle>
              <span className="mx-1 w-px bg-white/10" />
              <Toggle on={opt.onePerAlbum} onClick={() => setOpt({ ...opt, onePerAlbum: !opt.onePerAlbum })}>One per album</Toggle>
              <Toggle on={opt.onePerArtist} onClick={() => setOpt({ ...opt, onePerArtist: !opt.onePerArtist })}>One per artist</Toggle>
              <span className="mx-1 w-px bg-white/10" />
              {[5, 10, 25].map((n) => (
                <Toggle key={n} on={opt.n === n} onClick={() => setOpt({ ...opt, n })}>
                  Top {n}
                </Toggle>
              ))}
            </div>
            <HBars
              items={ranked.map((t) => ({ label: t.track, sub: `${t.artist}${t.album ? " · " + t.album : ""}`, value: opt.by === "plays" ? t.plays : min(t.ms) }))}
              format={(v) => (opt.by === "plays" ? `${fmtInt(v)} plays` : `${fmtInt(v)} min`)}
            />
          </Card>

          <Card title="Top artists" hint="By minutes listened" accent="bg-pink">
            <HBars
              color="bg-pink"
              items={r.topArtists.map((a) => ({ label: a.artist, sub: `${fmtPct(a.share, 1)} · ${a.tracks} songs`, value: min(a.ms) }))}
              format={(v) => `${fmtInt(v)} min`}
            />
          </Card>

          <Card title="Top albums" hint="Minutes, plus how many of its songs you played" accent="bg-orange">
            <HBars
              color="bg-orange"
              items={r.topAlbums.slice(0, 8).map((a) => ({ label: a.album, sub: `${a.artist} · ${a.tracks} songs heard`, value: min(a.ms) }))}
              format={(v) => `${fmtInt(v)} min`}
            />
          </Card>

          <Card title="Listening clock" hint={`Peak at ${fmtHour(r.clock.peakHour)} · ${fmtPct(r.clock.nightShare)} after 10pm`} accent="bg-lime">
            <div className="flex justify-center text-cream">
              <Clock hours={r.clock.hours} size={240} />
            </div>
          </Card>

          <Card title="Day of week" hint={`${fmtPct(r.clock.weekendShare)} on weekends (an even spread would be 29%)`} accent="bg-sky">
            <VBars items={r.clock.dows.map((v, i) => ({ label: DOWS[i], value: v }))} color="#8fd8ff" format={(v) => `${fmtInt(v)} min`} />
          </Card>

          <Card title="Month by month" hint="Minutes, with each month's top artist" accent="bg-violet">
            <VBars items={r.months.map((m) => ({ label: monthLabel(m.month), value: m.minutes }))} color="#6b3bff" format={(v) => `${fmtInt(v)} min`} />
            <div className="mt-4 max-h-40 space-y-1 overflow-y-auto pr-1 text-sm">
              {r.months.slice(-12).map((m) => (
                <div key={m.month} className="flex justify-between gap-3">
                  <span className="text-cream/55">{monthLabel(m.month)}</span>
                  <span className="truncate font-semibold">{m.topArtist ?? "—"}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Obsessions" hint="Your most concentrated listening" accent="bg-red">
            <div className="space-y-5">
              {r.obsession && (
                <div>
                  <p className="text-sm text-cream/55">Most plays of one song in any 7 days</p>
                  <p className="font-display text-4xl font-extrabold text-red">{r.obsession.peak}×</p>
                  <p className="font-semibold">{r.obsession.track}</p>
                  <p className="text-sm text-cream/55">{r.obsession.artist} · week of {fmtDay(r.obsession.from, true)}</p>
                </div>
              )}
              {r.onRepeat && (
                <div>
                  <p className="text-sm text-cream/55">Most plays of one song in a single day</p>
                  <p className="font-display text-3xl font-extrabold">{r.onRepeat.plays}×</p>
                  <p className="font-semibold">{r.onRepeat.track}</p>
                  <p className="text-sm text-cream/55">{fmtDay(r.onRepeat.day, true)}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Streaks" accent="bg-lime">
            <p className="text-sm text-cream/55">Days in a row with music</p>
            <p className="font-display text-5xl font-extrabold text-lime">{r.streak.days}</p>
            <p className="text-sm text-cream/55">
              {fmtDay(r.streak.from, true)} → {fmtDay(r.streak.to, true)}
            </p>
            {r.artistStreak && (
              <div className="mt-5">
                <p className="text-sm text-cream/55">Longest daily run with one artist</p>
                <p className="font-display text-2xl font-extrabold">{r.artistStreak.artist}</p>
                <p className="text-sm text-cream/55">
                  {r.artistStreak.days} days in a row, starting {fmtDay(r.artistStreak.from, true)}
                </p>
              </div>
            )}
          </Card>

          <Card title="Discovery" hint={scope === "all" ? "Pick a single year to see what was new" : "Artists you heard for the first time ever"} accent="bg-mint">
            {scope === "all" ? (
              <p className="text-cream/55">Discovery is measured within one year.</p>
            ) : (
              <>
                <div className="flex gap-6">
                  <div>
                    <p className="font-display text-4xl font-extrabold text-mint">{fmtInt(r.discovery.newArtists)}</p>
                    <p className="text-sm text-cream/55">new artists</p>
                  </div>
                  <div>
                    <p className="font-display text-4xl font-extrabold">{fmtInt(r.discovery.newTracks)}</p>
                    <p className="text-sm text-cream/55">new songs</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-cream/55">Share of music time on new artists</p>
                <Meter value={r.discovery.shareOfMinutes} color="bg-mint" />
                <p className="mt-1 text-sm font-semibold">{fmtPct(r.discovery.shareOfMinutes)}</p>
                {r.discovery.topNewArtist && (
                  <p className="mt-4 text-sm">
                    Best find: <b>{r.discovery.topNewArtist.artist}</b> ({fmtInt(min(r.discovery.topNewArtist.ms))} min)
                  </p>
                )}
                {r.discovery.topNewTrack && (
                  <p className="text-sm">
                    Top new song: <b>{r.discovery.topNewTrack.track}</b>
                  </p>
                )}
              </>
            )}
          </Card>

          <Card title="Comebacks" hint="Songs that came back after a year or more" accent="bg-violet">
            {r.comebacks.length ? (
              <HBars
                color="bg-violet"
                items={r.comebacks.map((c) => ({ label: c.track, sub: `${c.artist} · ${Math.round(c.gapDays / 30)} months away`, value: c.plays }))}
                format={(v) => `${v} plays`}
              />
            ) : (
              <p className="text-cream/55">No comebacks in this period.</p>
            )}
          </Card>

          <Card title="Skips & intent" hint="How you actually control playback" accent="bg-orange">
            <div className="space-y-3 text-sm">
              {[
                ["Skip rate", r.skips.rate, "bg-orange"],
                ["Picked by you (clicked or pressed play)", r.intent.intentional, "bg-lime"],
                ["Autoplay (next track rolled on)", r.intent.autoplay, "bg-sky"],
                ["Shuffle on", r.intent.shuffle, "bg-pink"],
              ].map(([l, v, c]) => (
                <div key={l as string}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-cream/70">{l as string}</span>
                    <span className="font-bold">{fmtPct(v as number)}</span>
                  </div>
                  <Meter value={v as number} color={c as string} />
                </div>
              ))}
              <p className="pt-1 text-cream/55">On average you skip after {r.skips.avgSecondsBeforeSkip.toFixed(0)} seconds.</p>
              {r.skips.loveHate && (
                <p>
                  💔 Love/hate: <b>{r.skips.loveHate.track}</b>, {r.skips.loveHate.plays} plays and {r.skips.loveHate.skips} skips
                </p>
              )}
              {r.skips.neverSkip && (
                <p>
                  🛡️ Least skipped: <b>{r.skips.neverSkip.artist}</b> ({fmtPct(r.skips.neverSkip.rate, 1)} skip rate)
                </p>
              )}
            </div>
          </Card>

          <Card title="Rising & fading" hint={r.movers ? "Change in share of your listening vs. last year" : "Pick a year that has the year before it in your data"} accent="bg-pink">
            {r.movers ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 font-bold text-mint">↗ Rising</p>
                  {r.movers.rising.map((m) => (
                    <p key={m.artist} className="flex justify-between">
                      <span className="truncate">{m.artist}</span>
                      <span className="font-bold">+{(m.delta * 100).toFixed(1)} pts</span>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-1 font-bold text-red">↘ Fading</p>
                  {r.movers.fading.map((m) => (
                    <p key={m.artist} className="flex justify-between">
                      <span className="truncate">{m.artist}</span>
                      <span className="font-bold">{(m.delta * 100).toFixed(1)} pts</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-cream/55">No comparison available.</p>
            )}
          </Card>

          <Card title="Ride or die" hint="Artists in your top 10 in the most years" accent="bg-yellow">
            {r.ridesOrDies.length ? (
              <HBars color="bg-yellow" items={r.ridesOrDies.map((a) => ({ label: a.artist, value: a.years }))} format={(v) => `${v} of ${r.ridesOrDies[0].total} yrs`} />
            ) : (
              <p className="text-cream/55">You need at least two years of data for this.</p>
            )}
          </Card>

          <Card title="Album runs" hint="5+ songs in order, shuffle off" accent="bg-yellow">
            {r.albumRuns.length ? (
              <HBars color="bg-yellow" items={r.albumRuns.map((a) => ({ label: a.album, sub: a.artist, value: a.runs }))} format={(v) => `${v} runs`} />
            ) : (
              <p className="text-cream/55">No full album listens in this period. You mostly shuffle.</p>
            )}
          </Card>

          <Card title="Quiet favorites" hint="Never skipped, played often, and not from your top 10 artists" accent="bg-mint">
            {r.quietFavorites.length ? (
              <HBars color="bg-mint" items={r.quietFavorites.map((t) => ({ label: t.track, sub: t.artist, value: t.plays }))} format={(v) => `${v} plays`} />
            ) : (
              <p className="text-cream/55">None found in this period.</p>
            )}
          </Card>

          <Card title="Sessions" hint="A session ends after 30 minutes of silence" accent="bg-blue">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-display text-4xl font-extrabold">{fmtInt(r.sessions.count)}</p>
                <p className="text-sm text-cream/55">sessions</p>
              </div>
              <div>
                <p className="font-display text-4xl font-extrabold">{fmtInt(r.sessions.avgMinutes)}</p>
                <p className="text-sm text-cream/55">avg minutes</p>
              </div>
            </div>
            {r.sessions.longest && (
              <p className="mt-4 text-sm">
                Longest: <b>{fmtInt(r.sessions.longest.minutes)} min</b> and {r.sessions.longest.tracks} tracks on {fmtDay(r.sessions.longest.day, true)}
              </p>
            )}
            {r.biggestDay && (
              <p className="mt-1 text-sm">
                Biggest day: <b>{fmtDay(r.biggestDay.day, true)}</b> with {fmtInt(r.biggestDay.minutes)} min{r.biggestDay.topArtist ? `, mostly ${r.biggestDay.topArtist}` : ""}
              </p>
            )}
            {r.lateNightArtist && (
              <p className="mt-1 text-sm">
                🌙 Midnight to 4am: <b>{r.lateNightArtist.artist}</b>
              </p>
            )}
            {r.weekendArtist && (
              <p className="mt-1 text-sm">
                ☀️ Weekend artist: <b>{r.weekendArtist.artist}</b>
              </p>
            )}
          </Card>

          <Card title="Persona" hint={r.persona.blurb} accent="bg-pink">
            <p className="font-display mb-4 text-4xl font-extrabold text-pink">{r.persona.name}</p>
            <div className="space-y-2.5 text-sm">
              {r.persona.traits.map((t) => (
                <div key={t.label}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-cream/70">{t.label}</span>
                    <span className="font-bold">{Math.round(t.value * 100)}</span>
                  </div>
                  <Meter value={t.value} color="bg-pink" />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Podcasts" accent="bg-sky">
            {r.podcasts.length ? (
              <HBars color="bg-sky" items={r.podcasts.map((p) => ({ label: p.show, sub: `${p.episodes} episodes`, value: p.minutes }))} format={(v) => `${fmtInt(v)} min`} />
            ) : (
              <p className="text-cream/55">No podcasts in this period.</p>
            )}
          </Card>

          <Card title="Where & how" hint={`${r.places.countries.length} countr${r.places.countries.length === 1 ? "y" : "ies"} · ${fmtPct(r.places.offlineShare)} offline`} accent="bg-blue">
            <HBars color="bg-blue" items={r.places.devices.slice(0, 6).map((d) => ({ label: d.name, value: d.share * 100 }))} format={(v) => `${v.toFixed(0)}%`} />
            {r.places.countries.length > 0 && <p className="mt-4 text-sm text-cream/55">Countries: {r.places.countries.join(", ")}</p>}
          </Card>
        </div>

        {/* custom metrics */}
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-5xl font-extrabold">
              Your metrics<span className="text-pink">.</span>
            </h2>
            <Link href="/lab" className="rounded-full bg-pink px-5 py-2.5 font-bold text-ink transition hover:scale-105">
              + New metric
            </Link>
          </div>
          {metrics.length === 0 ? (
            <Link href="/lab" className="mt-6 block rounded-[1.75rem] border-2 border-dashed border-white/15 p-10 text-center text-cream/60 transition hover:border-pink hover:text-cream">
              Ask for any stat in plain English, like <i>&ldquo;which artist do I play most on Sundays?&rdquo;</i>. The AI writes the metric and it shows up here and in your story.
            </Link>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {metrics.map((m) => (
                <CustomCard key={m.id} m={m} onDelete={() => deleteMetric(m.id)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CustomCard({ m, onDelete }: { m: CustomMetric; onDelete: () => void }) {
  const { plays, scope } = useData();
  const [out, setOut] = useState<MetricOutput | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setOut(null);
    setErr(null);
    sandbox()
      .run(plays, scope, m.code)
      .then((o) => alive && setOut(o))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [m.code, plays, scope]);
  return (
    <section className="relative rounded-[1.75rem] bg-ink-2 p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-extrabold">{m.title}</h3>
          <p className="mt-0.5 text-sm text-cream/55">{m.description}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Link href={`/lab?edit=${m.id}`} className="rounded-full px-2.5 py-1 text-xs font-bold text-cream/60 hover:bg-white/10 hover:text-cream">
            Edit
          </Link>
          <button onClick={onDelete} className="rounded-full px-2.5 py-1 text-xs font-bold text-cream/60 hover:bg-red/20 hover:text-red">
            Delete
          </button>
        </div>
      </div>
      {err ? <p className="rounded-xl bg-red/10 p-3 text-sm text-red">{err}</p> : out ? <MetricView out={out} unit={m.unit} /> : <div className="h-24 animate-pulse rounded-xl bg-white/5" />}
    </section>
  );
}
