# encore — your year in sound

A deeper, prettier take on the yearly music recap, built from your **Spotify Extended Streaming History**.
It has three parts:

- **Story**: a full-screen, tap-through recap for any year (or all time), ending in a summary card.
- **Dashboard**: more than 25 metrics, with ranking rules you can change.
- **Metric Lab**: describe a stat in plain English. Claude writes the code, it runs locally on your data, and the result is added to your dashboard and your story.

Everything is processed **in the browser**. Your history is parsed and stored in IndexedDB and is never uploaded.
The only server code is `/api/metric`, and it receives just the user's question plus a description of the data fields.

## Metrics beyond the usual top 5

| Metric | What it does |
| --- | --- |
| Fair top songs | Ranked by plays or minutes, with optional *one per album* / *one per artist* rules |
| Obsession detector | Most plays of one song in any rolling 7-day window |
| On repeat | Most plays of one song in a single day |
| Discovery | Artists and songs heard for the first time ever that year, plus their share of listening time |
| Comebacks | Songs that came back after more than a year away |
| Love/hate | Songs played a lot *and* skipped a lot |
| Least-skipped artist, skip speed | Skip rate, and how many seconds it takes you to skip |
| Intent | Picked by you vs. autoplay vs. shuffle |
| Variety score | Shannon entropy expressed as an "effective number of artists" |
| Rising & fading | Change in share of listening vs. the previous year |
| Ride or die | Artists in your top 10 in the most years |
| Album runs | 5+ songs from one album in order, shuffle off |
| Quiet favorites | Never skipped, played often, and not from your top 10 artists |
| Listening clock, day of week, months | When you listen, and each month's top artist |
| Streaks | Days in a row with music, and the longest daily run with one artist |
| Sessions, biggest day | Session = no gap longer than 30 minutes |
| Late-night and weekend artists | Who you play from midnight to 4am, and who you play on weekends far more than weekdays |
| Persona | Six traits (exploration, loyalty, after dark, replay, intention, album depth) |
| Podcasts, devices, countries, offline share | |

A play counts as a "stream" at 30 seconds or more. Listening time counts every millisecond.
Times are converted to the time zone you pick on the home page.

## Data format

Request **Extended streaming history** at spotify.com/account/privacy. Then drop the `my_spotify_data.zip` file,
or the `Streaming_History_Audio_*.json` / `Streaming_History_Video_*.json` files inside it, onto the home page.
The older "Account data" export (`StreamingHistory*.json`) is also accepted, but it has fewer fields.
Re-uploading overlapping files is safe because plays are de-duplicated.

Each entry looks like this:

```json
{ "ts": "2024-03-01T18:22:05Z", "platform": "ios", "ms_played": 201733, "conn_country": "US",
  "master_metadata_track_name": "…", "master_metadata_album_artist_name": "…", "master_metadata_album_album_name": "…",
  "spotify_track_uri": "spotify:track:…", "episode_name": null, "episode_show_name": null, "spotify_episode_uri": null,
  "reason_start": "clickrow", "reason_end": "trackdone", "shuffle": false, "skipped": false, "offline": false,
  "incognito_mode": false }
```

No files yet? Click **Try demo data** to explore with a generated, entirely fictional listening history.

## Run locally

```bash
cd wrapped
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for the Metric Lab
npm run dev                   # http://localhost:3000
```

## Deploy to Vercel

1. Import the repository in Vercel and set **Root Directory** to `wrapped`. The framework is detected as Next.js automatically.
2. Optional: add the environment variable `ANTHROPIC_API_KEY` to power the Metric Lab.
   If you leave it out, visitors can paste their own key in the Lab under *AI settings & privacy*. Their key is stored only in their browser.
3. Deploy. No database or other services are needed.

The Lab uses Claude Opus 5.5 (`claude-opus-5-5`) with structured outputs.
It also has server-side refusal fallbacks turned on, so a request the model declines is retried on a fallback model automatically.
The generated code runs in a Web Worker with network APIs removed and an 8-second timeout.
If the code throws an error, the Lab sends the error back to Claude once and asks for a fix.
