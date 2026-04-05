# Spotify Analytics

Deep analytics for your Spotify Extended Streaming History. Upload your downloaded JSON files and explore 9 years of listening data across 10 analysis pages.

## Features

- **Upload** your Spotify JSON files via drag-and-drop — no config needed
- **Overview**: KPIs, annual/monthly trends, listening calendar heatmap
- **Tracks**: Leaderboards by plays, time, completion %, skip rate + track detail pages
- **Artists**: Loyalty scores, YoY trends, per-artist deep dives
- **Albums**: Play counts, track coverage
- **Time Patterns**: Hour×day heatmap, hourly/weekly/seasonal distributions, configurable timezone
- **Sessions**: Session detection (30-min gap), distribution, expandable play-by-play
- **Podcasts**: Show rankings, episode counts, listening hours
- **Devices**: Platform breakdown with per-device top artists
- **Exclusion filters**: Remove any artist from leaderboards

## Setup

### Requirements

- Python 3.10+
- Node.js 20+

### First-time setup

```bash
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
```

### Start (one command)

```bash
./start.sh
```

Then open [http://localhost:3000](http://localhost:3000), upload your Spotify JSON files, and explore.

## Data

Download your Spotify Extended Streaming History at **spotify.com/account/privacy** → "Download your data" → "Extended streaming history". Spotify emails a download link within ~30 days.

Upload the `Streaming_History_Audio_*.json` files (and optionally `Streaming_History_Video_*.json`).
