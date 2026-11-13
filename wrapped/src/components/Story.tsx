"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Report } from "@/lib/analytics";
import { fmtDay, fmtHour, fmtInt, fmtPct, monthLabel } from "@/lib/analytics";
import { Blob, Clock, Rings, Squiggle, Starburst, Wordmark } from "./ui";
import type { CustomMetric } from "@/lib/data-context";
import type { MetricOutput } from "@/lib/sandbox";
import { MetricView } from "./MetricView";

interface Slide {
  id: string;
  bg: string; // tailwind classes for background + text colour
  ms?: number;
  body: React.ReactNode;
}

const Big = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`font-display animate-rise font-extrabold ${className}`}>{children}</p>
);
const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="animate-rise text-sm font-bold uppercase tracking-[0.2em] opacity-80">{children}</p>
);
const Sub = ({ children, d = "d3" }: { children: React.ReactNode; d?: string }) => (
  <p className={`${d} mt-6 max-w-md animate-rise text-lg font-medium opacity-90 sm:text-xl`}>{children}</p>
);

function RankList({ rows, dark = false }: { rows: { title: string; sub: string; value: string }[]; dark?: boolean }) {
  return (
    <ol className="mt-8 space-y-3 sm:space-y-4">
      {rows.map((r, i) => (
        <li key={i} className={`d${Math.min(6, i + 2)} flex animate-rise items-center gap-4`}>
          <span className={`font-display w-10 shrink-0 text-5xl font-extrabold ${dark ? "text-ink/40" : "text-cream/40"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-2xl font-extrabold sm:text-3xl">{r.title}</p>
            <p className="truncate text-sm font-semibold opacity-75">{r.sub}</p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums opacity-80">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}

export function buildSlides(r: Report, custom: { m: CustomMetric; out: MetricOutput }[]): Slide[] {
  const S: Slide[] = [];
  const year = r.label;
  const top = r.topArtists[0];

  S.push({
    id: "intro",
    bg: "bg-lime text-ink",
    ms: 5000,
    body: (
      <>
        <Starburst className="absolute -right-10 top-10 w-56 animate-spin-slow" color="#ff4fb8" />
        <Blob className="absolute -bottom-16 -left-16 w-72 animate-float" color="#6b3bff" />
        <div className="relative">
          <Kicker>encore presents</Kicker>
          <Big className="mt-4 text-[clamp(4.5rem,22vw,11rem)]">{year}</Big>
          <Big className="d2 text-5xl sm:text-6xl">Let&apos;s rewind.</Big>
          <Sub>Tap the right side to go forward, the left to go back. Hold anywhere to pause.</Sub>
        </div>
      </>
    ),
  });

  const days = r.summary.minutes / 1440;
  S.push({
    id: "minutes",
    bg: "bg-violet text-cream",
    body: (
      <>
        <Rings className="absolute -right-24 -top-24 w-96 animate-spin-slow opacity-30" color="#d4ff3a" />
        <div className="relative">
          <Kicker>Time spent listening</Kicker>
          <Big className="d1 mt-4 text-[clamp(3.5rem,17vw,9rem)] text-lime">{fmtInt(r.summary.minutes)}</Big>
          <Big className="d2 text-4xl sm:text-5xl">minutes.</Big>
          <Sub>
            That&apos;s {days >= 1 ? `${days.toFixed(1)} full days` : `${(days * 24).toFixed(1)} hours`}. You pressed play on {r.summary.activeDays} of{" "}
            {r.summary.spanDays} days and averaged {fmtInt(r.summary.avgPerActiveDay)} minutes on those days.
          </Sub>
        </div>
      </>
    ),
  });

  S.push({
    id: "clock",
    bg: "bg-ink text-cream",
    body: (
      <div className="relative flex flex-col items-start">
        <Kicker>Your listening clock</Kicker>
        <Big className="d1 mt-4 text-5xl sm:text-6xl">
          Peak hour: <span className="text-lime">{fmtHour(r.clock.peakHour)}</span>
        </Big>
        <div className="d2 mt-6 animate-pop self-center text-cream">
          <Clock hours={r.clock.hours} size={280} />
        </div>
        <Sub d="d4">
          {fmtPct(r.clock.nightShare)} of your listening happened after 10pm.{" "}
          {r.clock.weekendShare > 2 / 7 + 0.05 ? "Weekends were your loudest days." : r.clock.weekendShare < 2 / 7 - 0.05 ? "Your weekdays were busier than your weekends." : ""}
        </Sub>
      </div>
    ),
  });

  if (top) {
    S.push({
      id: "top-artist",
      bg: "bg-pink text-ink",
      body: (
        <>
          <Blob className="absolute -right-20 bottom-10 w-80 animate-float" color="#ffd23f" />
          <div className="relative">
            <Kicker>Your top artist</Kicker>
            <Big className="d1 mt-6 text-[clamp(3rem,14vw,7.5rem)] [overflow-wrap:anywhere]">{top.artist}</Big>
            <Sub>
              {fmtInt(top.ms / 60000)} minutes, or {fmtPct(top.share)} of all your music time, across {top.tracks} different songs.
            </Sub>
          </div>
        </>
      ),
    });
  }

  if (r.topArtists.length > 1) {
    S.push({
      id: "artists",
      bg: "bg-orange text-ink",
      ms: 9000,
      body: (
        <div className="relative">
          <Kicker>Top artists</Kicker>
          <RankList dark rows={r.topArtists.slice(0, 5).map((a) => ({ title: a.artist, sub: `${a.tracks} songs`, value: `${fmtInt(a.ms / 60000)} min` }))} />
        </div>
      ),
    });
  }

  if (r.topTracks.length) {
    const t0 = r.topTracks[0];
    S.push({
      id: "songs",
      bg: "bg-blue text-cream",
      ms: 9500,
      body: (
        <div className="relative">
          <Kicker>Top songs · one per album</Kicker>
          <RankList rows={r.topTracks.map((t) => ({ title: t.track, sub: t.artist + (t.album ? ` · ${t.album}` : ""), value: `${t.plays} plays` }))} />
          {r.rawTopSameAlbum > 1 && (
            <p className="d6 mt-8 animate-rise rounded-2xl bg-cream/15 p-4 text-sm font-semibold">
              Without the one-per-album rule, a single album would have taken {r.rawTopSameAlbum} of these 5 spots.
            </p>
          )}
          {r.rawTopSameAlbum <= 1 && t0 && <Sub d="d6">“{t0.track}” was your number one song.</Sub>}
        </div>
      ),
    });
  }

  if (r.obsession && r.obsession.peak >= 5) {
    S.push({
      id: "obsession",
      bg: "bg-red text-cream",
      body: (
        <>
          <Starburst className="absolute -left-20 -top-20 w-80 animate-spin-slow opacity-40" color="#ffd23f" />
          <div className="relative">
            <Kicker>Your biggest obsession</Kicker>
            <Big className="d1 mt-4 text-[clamp(5rem,26vw,12rem)] text-yellow">{r.obsession.peak}×</Big>
            <Big className="d2 text-3xl sm:text-5xl">in a single week.</Big>
            <Sub>
              In the 7 days starting {fmtDay(r.obsession.from)}, you played <b>“{r.obsession.track}”</b> by {r.obsession.artist} {r.obsession.peak} times.
            </Sub>
          </div>
        </>
      ),
    });
  }

  if (r.onRepeat && r.onRepeat.plays >= 4) {
    S.push({
      id: "repeat",
      bg: "bg-yellow text-ink",
      body: (
        <div className="relative">
          <Kicker>On repeat</Kicker>
          <Big className="d1 mt-6 text-5xl sm:text-7xl">
            {fmtDay(r.onRepeat.day)}: “{r.onRepeat.track}”, {r.onRepeat.plays} times.
          </Big>
          <Sub>The most times you played one song in one day. {r.onRepeat.artist} would be proud.</Sub>
        </div>
      ),
    });
  }

  if (r.scope !== "all" && r.discovery.newArtists > 0) {
    S.push({
      id: "discovery",
      bg: "bg-mint text-ink",
      body: (
        <>
          <Squiggle className="absolute right-0 top-24 w-64" color="#6b3bff" />
          <div className="relative">
            <Kicker>New to you this year</Kicker>
            <Big className="d1 mt-4 text-[clamp(4rem,20vw,10rem)]">{fmtInt(r.discovery.newArtists)}</Big>
            <Big className="d2 text-4xl sm:text-5xl">new artists.</Big>
            <Sub>
              {fmtPct(r.discovery.shareOfMinutes)} of your music time went to artists you hadn&apos;t heard before.
              {r.discovery.topNewArtist && (
                <>
                  {" "}
                  Your best find was <b>{r.discovery.topNewArtist.artist}</b>.
                </>
              )}
            </Sub>
          </div>
        </>
      ),
    });
  }

  if (r.comebacks.length) {
    S.push({
      id: "comebacks",
      bg: "bg-violet text-cream",
      ms: 9000,
      body: (
        <div className="relative">
          <Kicker>The comebacks</Kicker>
          <Big className="d1 mt-4 text-4xl sm:text-5xl">Songs you came back to after a year or more.</Big>
          <RankList rows={r.comebacks.slice(0, 4).map((c) => ({ title: c.track, sub: `${c.artist} · ${Math.round(c.gapDays / 30)} months away`, value: `${c.plays} plays` }))} />
        </div>
      ),
    });
  }

  if (r.skips.loveHate) {
    const lh = r.skips.loveHate;
    S.push({
      id: "lovehate",
      bg: "bg-orange text-ink",
      body: (
        <div className="relative">
          <Kicker>It&apos;s complicated</Kicker>
          <Big className="d1 mt-6 text-5xl sm:text-7xl [overflow-wrap:anywhere]">“{lh.track}”</Big>
          <Sub>
            Your love/hate song. You played it {lh.plays} times and skipped it {lh.skips} times. {lh.artist} knows what they did.
          </Sub>
        </div>
      ),
    });
  }

  if (r.skips.neverSkip) {
    S.push({
      id: "skips",
      bg: "bg-sky text-ink",
      body: (
        <div className="relative">
          <Kicker>Skip behaviour</Kicker>
          <Big className="d1 mt-4 text-[clamp(4rem,20vw,10rem)]">{fmtPct(r.skips.rate)}</Big>
          <Big className="d2 text-3xl sm:text-5xl">of songs got skipped.</Big>
          <Sub>
            When you skip, it takes you about {r.skips.avgSecondsBeforeSkip.toFixed(0)} seconds to decide. You almost never skipped{" "}
            <b>{r.skips.neverSkip.artist}</b>: {fmtPct(r.skips.neverSkip.rate, 1)} across {r.skips.neverSkip.plays} plays.
          </Sub>
        </div>
      ),
    });
  }

  if (r.months.length > 2) {
    S.push({
      id: "months",
      bg: "bg-ink-2 text-cream",
      ms: 11000,
      body: (
        <div className="relative">
          <Kicker>The soundtrack, month by month</Kicker>
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {r.months.slice(-12).map((m, i) => (
              <div key={m.month} className="flex animate-rise items-baseline gap-3 border-b border-white/10 py-1" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="w-14 shrink-0 text-xs font-bold uppercase text-lime">{monthLabel(m.month)}</span>
                <span className="font-display truncate text-xl font-bold">{m.topArtist ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (r.movers && (r.movers.rising.length || r.movers.fading.length)) {
    S.push({
      id: "movers",
      bg: "bg-pink text-ink",
      body: (
        <div className="relative">
          <Kicker>Compared with last year</Kicker>
          {r.movers.rising[0] && (
            <>
              <p className="d1 mt-6 animate-rise font-bold">↗ Biggest rise</p>
              <Big className="d1 text-5xl sm:text-6xl">{r.movers.rising[0].artist}</Big>
              <p className="d2 animate-rise font-semibold">+{(r.movers.rising[0].delta * 100).toFixed(1)} points of your listening</p>
            </>
          )}
          {r.movers.fading[0] && (
            <>
              <p className="d3 mt-8 animate-rise font-bold">↘ Drifted away from</p>
              <Big className="d3 text-4xl opacity-80 sm:text-5xl">{r.movers.fading[0].artist}</Big>
              <p className="d4 animate-rise font-semibold">{(r.movers.fading[0].delta * 100).toFixed(1)} points</p>
            </>
          )}
        </div>
      ),
    });
  }

  if (r.streak.days > 2) {
    S.push({
      id: "streaks",
      bg: "bg-lime text-ink",
      body: (
        <div className="relative">
          <Kicker>Streaks</Kicker>
          <Big className="d1 mt-4 text-[clamp(4.5rem,22vw,11rem)]">{r.streak.days}</Big>
          <Big className="d2 text-3xl sm:text-5xl">days in a row with music.</Big>
          <Sub>
            From {fmtDay(r.streak.from)} to {fmtDay(r.streak.to)}.
            {r.artistStreak && r.artistStreak.days > 2 && (
              <>
                {" "}
                Your longest run with one artist: <b>{r.artistStreak.artist}</b>, {r.artistStreak.days} days in a row.
              </>
            )}
          </Sub>
        </div>
      ),
    });
  }

  if (r.lateNightArtist || r.weekendArtist) {
    S.push({
      id: "moods",
      bg: "bg-violet text-cream",
      body: (
        <div className="relative space-y-10">
          <Kicker>Different times, different artists</Kicker>
          {r.lateNightArtist && (
            <div className="d1 animate-rise">
              <p className="font-bold text-lime">🌙 Your midnight-to-4am artist</p>
              <p className="font-display text-5xl font-extrabold sm:text-6xl">{r.lateNightArtist.artist}</p>
            </div>
          )}
          {r.weekendArtist && (
            <div className="d3 animate-rise">
              <p className="font-bold text-pink">☀️ Your weekend-only artist</p>
              <p className="font-display text-5xl font-extrabold sm:text-6xl">{r.weekendArtist.artist}</p>
              <p className="mt-1 text-sm opacity-80">You played them {r.weekendArtist.lift.toFixed(1)}× more on weekends than weekdays, relative to everything else.</p>
            </div>
          )}
        </div>
      ),
    });
  }

  if (r.albumRuns.length) {
    const a = r.albumRuns[0];
    S.push({
      id: "albums",
      bg: "bg-yellow text-ink",
      body: (
        <div className="relative">
          <Kicker>Album listening</Kicker>
          <Big className="d1 mt-6 text-5xl sm:text-7xl [overflow-wrap:anywhere]">{a.album}</Big>
          <Sub>
            by {a.artist}. You played it straight through, 5 or more songs in order with shuffle off, {a.runs} time{a.runs > 1 ? "s" : ""}.
          </Sub>
        </div>
      ),
    });
  }

  if (r.biggestDay && r.sessions.longest) {
    S.push({
      id: "marathon",
      bg: "bg-blue text-cream",
      body: (
        <div className="relative">
          <Kicker>Marathon mode</Kicker>
          <Big className="d1 mt-6 text-5xl sm:text-6xl">
            {fmtDay(r.biggestDay.day)} was your biggest day: <span className="text-lime">{fmtInt(r.biggestDay.minutes)} minutes</span>.
          </Big>
          <Sub>
            {r.biggestDay.topArtist && <>Mostly {r.biggestDay.topArtist}. </>}Your longest single session lasted {fmtInt(r.sessions.longest.minutes)} minutes and covered{" "}
            {r.sessions.longest.tracks} tracks.
          </Sub>
        </div>
      ),
    });
  }

  for (const { m, out } of custom) {
    S.push({
      id: "custom-" + m.id,
      bg: "bg-ink-3 text-cream",
      ms: 9000,
      body: (
        <div className="relative">
          <Kicker>Your metric</Kicker>
          <Big className="d1 mt-4 text-4xl sm:text-5xl">{m.title}</Big>
          <p className="d2 mt-2 animate-rise text-cream/70">{m.description}</p>
          <div className="d3 mt-8 animate-rise">
            <MetricView out={out} unit={m.unit} large />
          </div>
        </div>
      ),
    });
  }

  S.push({
    id: "persona",
    bg: "bg-gradient-to-br from-violet via-pink to-orange text-cream",
    ms: 10000,
    body: (
      <div className="relative">
        <Kicker>Your listening persona</Kicker>
        <Big className="d1 mt-4 text-[clamp(3.2rem,15vw,8rem)]">{r.persona.name}</Big>
        <Sub d="d2">{r.persona.blurb}</Sub>
        <div className="d4 mt-8 grid animate-rise grid-cols-2 gap-x-6 gap-y-3">
          {r.persona.traits.map((t) => (
            <div key={t.label}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span>{t.label}</span>
                <span>{Math.round(t.value * 100)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/25">
                <div className="h-full origin-left animate-grow rounded-full bg-cream" style={{ width: `${Math.max(3, t.value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  S.push({ id: "summary", bg: "bg-ink text-cream", ms: 60_000, body: <SummaryCard r={r} /> });
  return S;
}

function SummaryCard({ r }: { r: Report }) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="d1 animate-pop overflow-hidden rounded-[2rem] bg-lime p-6 text-ink shadow-2xl">
        <div className="flex items-center justify-between">
          <Wordmark className="text-ink" dot="text-pink" />
          <span className="font-display text-3xl font-extrabold">{r.label}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Top artists</p>
            <ol className="mt-1 space-y-0.5 text-sm font-bold">
              {r.topArtists.slice(0, 5).map((a, i) => (
                <li key={a.artist} className="truncate">
                  {i + 1}. {a.artist}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Top songs</p>
            <ol className="mt-1 space-y-0.5 text-sm font-bold">
              {r.topTracks.slice(0, 5).map((t, i) => (
                <li key={t.key} className="truncate">
                  {i + 1}. {t.track}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Minutes</p>
            <p className="font-display text-3xl font-extrabold">{fmtInt(r.summary.minutes)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Persona</p>
            <p className="font-display text-2xl font-extrabold leading-tight">{r.persona.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Biggest obsession</p>
            <p className="truncate text-sm font-bold">{r.obsession?.track ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Variety score</p>
            <p className="font-display text-2xl font-extrabold">{r.diversity.score}/100</p>
          </div>
        </div>
      </div>
      <div className="d3 mt-6 flex animate-rise flex-wrap justify-center gap-3" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Link href="/dashboard" className="rounded-full bg-cream px-5 py-2.5 font-bold text-ink">
          Open the dashboard
        </Link>
        <Link href="/lab" className="rounded-full border border-white/30 px-5 py-2.5 font-bold">
          Make a metric
        </Link>
      </div>
    </div>
  );
}

export function StoryPlayer({ slides, onClose }: { slides: Slide[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[Math.min(i, slides.length - 1)];
  const next = useCallback(() => setI((x) => Math.min(slides.length - 1, x + 1)), [slides.length]);
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") (e.preventDefault(), next());
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  const dur = slide.ms ?? 7500;
  const ids = useMemo(() => slides.map((s) => s.id), [slides]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        className={`grain relative flex h-full w-full max-w-[560px] select-none flex-col overflow-hidden transition-colors duration-500 sm:my-4 sm:h-[calc(100dvh-2rem)] sm:max-h-[960px] sm:rounded-[2rem] ${slide.bg}`}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* progress */}
        <div className="relative z-20 flex gap-1 px-3 pt-3">
          {ids.map((id, k) => (
            <div key={id} className="h-1 flex-1 overflow-hidden rounded-full bg-current/25">
              {k < i && <div className="h-full w-full bg-current" />}
              {k === i && (
                <div
                  key={`${id}-${i}`}
                  className="h-full w-full origin-left bg-current"
                  style={{ animation: `progress ${dur}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
                  onAnimationEnd={() => i < slides.length - 1 && next()}
                />
              )}
            </div>
          ))}
        </div>
        <div className="relative z-20 flex items-center justify-between px-4 pt-3">
          <Wordmark className="text-xl" dot="text-current" />
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Close story"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-current/10 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* tap zones */}
        <button aria-label="Previous" className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize" onClick={prev} />
        <button aria-label="Next" className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize" onClick={next} />

        <div key={slide.id} className="relative flex flex-1 flex-col justify-center overflow-hidden px-7 pb-12 sm:px-10">
          <div className={slide.id === "summary" ? "relative z-20" : ""}>{slide.body}</div>
        </div>
      </div>
    </div>
  );
}
