"use client";

import { Squiggle } from "./ui";

const PRIVACY_URL = "https://www.spotify.com/account/privacy/";

const STEPS: { title: string; body: React.ReactNode; extra?: React.ReactNode }[] = [
  {
    title: "Open your Spotify privacy page",
    body: (
      <>
        This isn&apos;t in the Spotify app. It&apos;s on the Spotify website, and a computer is easiest. Log in if it asks.
      </>
    ),
    extra: (
      <a
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-bold text-ink transition hover:scale-105"
      >
        Open Spotify privacy page ↗
      </a>
    ),
  },
  {
    title: "Scroll to “Download your data”",
    body: <>Near the bottom of the page you&apos;ll see a few checkboxes for different data packages.</>,
  },
  {
    title: "Tick “Extended streaming history”",
    body: (
      <>
        This is the important one. It covers <b className="text-cream">every play since you opened your account</b>. Untick the other boxes so your request is quicker. The basic “Account data” only goes back about a year.
      </>
    ),
    extra: (
      <div className="mt-3 space-y-2 rounded-2xl bg-ink p-4 text-sm" aria-hidden>
        <div className="flex items-center gap-3 opacity-50">
          <span className="h-5 w-5 shrink-0 rounded border-2 border-cream/50" />
          Account data
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-lime/10 p-1 font-bold text-lime">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-lime text-xs text-ink">✓</span>
          Extended streaming history
        </div>
        <div className="flex items-center gap-3 opacity-50">
          <span className="h-5 w-5 shrink-0 rounded border-2 border-cream/50" />
          Technical log information
        </div>
      </div>
    ),
  },
  {
    title: "Click “Request data”, then confirm the email",
    body: (
      <>
        Spotify sends a confirmation email straight away. Open it and click the confirm link, or the request won&apos;t start. Check spam if it doesn&apos;t arrive.
      </>
    ),
  },
  {
    title: "Wait for the “your data is ready” email",
    body: (
      <>
        Spotify says it can take <b className="text-cream">up to 30 days</b>, and it&apos;s often quicker. Download the file soon after it arrives, because the link expires.
      </>
    ),
  },
  {
    title: "Drop the zip here",
    body: (
      <>
        You&apos;ll get <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">my_spotify_data.zip</code>. Drop the whole zip on this page. There&apos;s no need to unzip it.
      </>
    ),
  },
];

export function RequestGuide({ id = "get-data" }: { id?: string }) {
  return (
    <section id={id} className="relative scroll-mt-20 rounded-[2rem] bg-ink-2 p-6 sm:p-10">
      <Squiggle className="absolute -top-6 right-6 w-32 sm:right-10 sm:w-40" color="#d4ff3a" />
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime">First time? Takes 2 minutes</p>
      <h2 className="font-display mt-3 text-4xl font-extrabold sm:text-5xl">How to get your Spotify data</h2>
      <p className="mt-3 max-w-2xl text-cream/70">
        Spotify will send your full listening history for free, but you have to ask for it, and it takes a while to arrive. Request it now, and try the demo while you wait.
      </p>

      <ol className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2 [&>*]:min-w-0">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-xl font-extrabold text-ink">{i + 1}</span>
            <div className="min-w-0 pt-1">
              <p className="font-display text-2xl font-extrabold">{s.title}</p>
              <p className="mt-1 text-cream/70">{s.body}</p>
              {s.extra}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["💸", "It's free", "Every account can request its data, free and premium alike."],
          ["🔒", "Stays private", "Your file is read in your browser and never uploaded."],
          ["⏳", "Bookmark this page", "Come back when the email arrives. Nothing to set up."],
        ].map(([icon, t, d]) => (
          <div key={t} className="rounded-2xl bg-white/[0.04] p-4">
            <p className="font-bold">
              {icon} {t}
            </p>
            <p className="mt-1 text-cream/60">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
