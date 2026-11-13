import type { Play } from "./types";

/**
 * Generates a realistic, fully fictional listening history in the exact shape
 * Spotify exports, so the whole app can be explored before real data arrives.
 * All artists, albums and songs are invented.
 */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const A1 = ["Velvet", "Neon", "Paper", "Glass", "Static", "Honey", "Midnight", "Lunar", "Cobalt", "Feral", "Golden", "Hollow", "Silver", "Crimson", "Electric", "Quiet", "Wild", "Tidal", "Echo", "Saffron", "Juniper", "Marble", "Prism", "Copper"];
const A2 = ["Harbor", "Lanterns", "Wolves", "Arcade", "Parade", "Orchard", "Satellites", "Gardens", "Machines", "Rivals", "Tides", "Ghosts", "Comets", "Atlas", "Season", "Motel", "Bloom", "Signal", "Kites", "Dynasty"];
const SOLO = ["Mara Quill", "Theo Vance", "Juno Okafor", "Lio Park", "Sable Reyes", "Ines Moreau", "Kofi Bright", "Nova Lindqvist", "Remy Castell", "Aya Sato", "Dex Holloway", "Wren Calloway", "Omar Vale", "Pia Fontaine"];
const W = ["Summer", "Ceiling", "Fever", "Postcards", "Gravity", "Daylight", "Overthinking", "Slow", "Heartbeat", "Ocean", "City", "Rain", "Polaroid", "Highway", "Static", "Cherry", "Sunday", "Lights", "Echoes", "Paper", "Glow", "Wires", "Satellite", "Honey", "Riot", "Velvet", "窓", "Bloom", "Mirror", "Crash", "Golden", "Weekend", "Siren", "Northern", "Orbit", "Tender", "Electric", "Wild", "Lucid", "Nectar"];
const W2 = ["Dreams", "Again", "Tonight", "Forever", "in Blue", "(Interlude)", "Song", "Season", "Machine", "Lovers", "Theory", "Runaway", "Hours", "Letters", "at Dawn", "Club", "Signal", "Feelings", "Parade", "Memory"];

export function generateDemo(seed = 7): Play[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

  // ── catalogue ──
  interface Track { name: string; album: string; artist: string; uri: string; dur: number; appeal: number }
  interface Artist { name: string; tracks: Track[]; weight: number; start: number; span: number; burst: number }
  const names = new Set<string>();
  while (names.size < 34) names.add(`${pick(A1)} ${pick(A2)}`);
  SOLO.forEach((n) => names.add(n));
  const artists: Artist[] = [];
  const START = Date.UTC(2021, 5, 1);
  const END = Date.UTC(2026, 9, 31);
  const DAYS = Math.floor((END - START) / 86_400_000);
  let uriN = 0;
  [...names].forEach((name, i) => {
    const albums = 1 + Math.floor(r() * 3);
    const tracks: Track[] = [];
    for (let a = 0; a < albums; a++) {
      const album = r() < 0.5 ? `${pick(W)} ${pick(W2)}` : pick(W);
      const n = 6 + Math.floor(r() * 7);
      for (let t = 0; t < n; t++) {
        tracks.push({
          name: r() < 0.3 ? pick(W) : `${pick(W)} ${pick(W2)}`,
          album,
          artist: name,
          uri: `spotify:track:demo${(uriN++).toString(36).padStart(6, "0")}`,
          dur: 140_000 + Math.floor(r() * 160_000),
          appeal: Math.pow(r(), 2.2), // a few hits per album
        });
      }
    }
    artists.push({
      name,
      tracks,
      weight: Math.pow(1 / (i + 1), 0.85) * (0.5 + r()),
      start: Math.floor(r() * DAYS * 0.97) * (i < 6 ? 0 : 1), // core artists from day 0
      span: 200 + Math.floor(r() * 1400),
      burst: Math.floor(r() * DAYS),
    });
  });
  const shows = [
    { show: "The Long Way Round", eps: 120 },
    { show: "Small Questions, Big Answers", eps: 80 },
  ];
  const platforms = ["iOS 17.2 (iPhone15,2)", "Android OS 14 API 34 (Pixel 8)", "Windows 10 (10.0.19045; x64)", "macOS 14.1 [arm 2]", "web_player linux"];
  const countries = ["US", "US", "US", "US", "GB", "IL", "FR"];

  const tzShift = new Date().getTimezoneOffset() * 60_000;
  const plays: Play[] = [];
  for (let d = 0; d < DAYS; d++) {
    const dayStart = START + d * 86_400_000;
    const dow = new Date(dayStart).getUTCDay();
    if (r() < 0.06) continue; // quiet days
    const country = r() < 0.97 ? "US" : pick(countries);
    const device = r() < 0.7 ? platforms[0] : pick(platforms);
    // artist weights for today
    const ws = artists.map((a) => {
      if (d < a.start) return 0;
      const age = d - a.start;
      const fade = age > a.span ? Math.exp(-(age - a.span) / 120) : 1;
      const burst = Math.abs(d - a.burst) < 10 ? 6 : 1;
      return a.weight * fade * burst;
    });
    const total = ws.reduce((x, y) => x + y, 0);
    const pickArtist = () => {
      let x = r() * total;
      for (let i = 0; i < ws.length; i++) if ((x -= ws[i]) <= 0) return artists[i];
      return artists[0];
    };

    const sessions = 1 + Math.floor(r() * 3);
    for (let s = 0; s < sessions; s++) {
      const weekend = dow === 0 || dow === 6;
      const hourPool = weekend ? [10, 11, 13, 15, 17, 20, 22, 23] : [7, 8, 8, 12, 17, 18, 19, 21, 22, 23, 0, 1];
      // Hours are generated in the viewer's own time zone so the demo clock looks natural anywhere.
      let t = dayStart + pick(hourPool) * 3_600_000 + Math.floor(r() * 3_600_000) + tzShift;
      // podcasts on weekday mornings
      if (!weekend && s === 0 && r() < 0.35) {
        const sh = pick(shows);
        const ms = 600_000 + Math.floor(r() * 2_400_000);
        t += ms;
        plays.push(mk(t, ms, { kind: "episode", show: sh.show, episode: `Ep. ${1 + Math.floor(r() * sh.eps)}: ${pick(W)} ${pick(W2)}`, uri: `spotify:episode:demo${Math.floor(r() * 1e6)}` }, device, country, "clickrow", "endplay", false, false));
        continue;
      }
      const len = 4 + Math.floor(r() * 22);
      const shuffle = r() < 0.55;
      let focus = pickArtist();
      let prevSkip = false;
      for (let k = 0; k < len; k++) {
        if (r() < 0.35) focus = pickArtist();
        const tr = focus.tracks.reduce((best, tk) => (r() * (0.2 + tk.appeal) > r() * (0.2 + best.appeal) ? tk : best), pick(focus.tracks));
        const skipP = 0.32 - tr.appeal * 0.28;
        const skipped = r() < skipP;
        const ms = skipped ? 2_000 + Math.floor(r() * 40_000) : r() < 0.06 ? Math.floor(tr.dur * r()) : tr.dur;
        t += ms + Math.floor(r() * 4_000);
        const reasonStart = k === 0 ? (r() < 0.6 ? "clickrow" : "playbtn") : prevSkip ? "fwdbtn" : r() < 0.08 ? "clickrow" : "trackdone";
        const reasonEnd = skipped ? "fwdbtn" : k === len - 1 ? "endplay" : "trackdone";
        plays.push(mk(t, ms, { kind: "track", track: tr.name, artist: tr.artist, album: tr.album, uri: tr.uri }, device, country, reasonStart, reasonEnd, shuffle, skipped));
        prevSkip = skipped;
      }
    }
  }
  return plays.sort((a, b) => a.ts - b.ts);

  function mk(ts: number, ms: number, c: Partial<Play>, platform: string, country: string, rs: string, re: string, shuffle: boolean, skipped: boolean): Play {
    return {
      ts,
      ms,
      kind: c.kind ?? "track",
      track: c.track ?? null,
      artist: c.artist ?? null,
      album: c.album ?? null,
      uri: c.uri ?? null,
      show: c.show ?? null,
      episode: c.episode ?? null,
      platform,
      country,
      reasonStart: rs,
      reasonEnd: re,
      shuffle,
      skipped,
      offline: r() < 0.04,
      incognito: false,
    };
  }
}
