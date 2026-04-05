import pandas as pd
from datetime import date, timedelta


def compute_kpi_global(df: pd.DataFrame, streak_data: dict) -> dict:
    tracks = df[df["content_type"] == "track"]
    total_ms = tracks["ms_played_valid"].sum()
    top_artist_row = (
        tracks.groupby("master_metadata_album_artist_name")["ms_played_valid"]
        .sum()
        .idxmax()
        if not tracks.empty else None
    )
    top_track_row = (
        tracks.groupby("spotify_track_uri")["ms_played_valid"]
        .sum()
        .idxmax()
        if not tracks.empty else None
    )
    top_track_name = (
        tracks[tracks["spotify_track_uri"] == top_track_row]["master_metadata_track_name"].iloc[0]
        if top_track_row is not None and not tracks.empty else None
    )

    active_days = tracks["date"].nunique()
    date_min = df["ts"].min().date() if not df.empty else None
    date_max = df["ts"].max().date() if not df.empty else None
    span_days = (date_max - date_min).days + 1 if date_min and date_max else 0

    # Most active day
    daily = tracks.groupby("date")["ms_played_valid"].sum()
    most_active_date = daily.idxmax() if not daily.empty else None
    most_active_hours = round(daily.max() / 3_600_000, 1) if not daily.empty else 0

    return {
        "total_plays": int(len(tracks)),
        "total_plays_valid": int(tracks["ms_played_valid"].notna().sum()),
        "total_hours": round(float(total_ms) / 3_600_000, 1) if pd.notna(total_ms) else 0,
        "total_days": round(float(total_ms) / 86_400_000, 1) if pd.notna(total_ms) else 0,
        "unique_tracks": int(tracks["spotify_track_uri"].nunique()),
        "unique_artists": int(tracks["master_metadata_album_artist_name"].nunique()),
        "unique_albums": int(tracks["master_metadata_album_album_name"].nunique()),
        "unique_shows": int(df[df["content_type"] == "podcast"]["episode_show_name"].nunique()),
        "date_start": str(date_min) if date_min else None,
        "date_end": str(date_max) if date_max else None,
        "span_days": span_days,
        "active_days": int(active_days),
        "activity_density_pct": round(100 * active_days / span_days, 1) if span_days else 0,
        "top_artist": top_artist_row,
        "top_track": top_track_name,
        "most_active_date": str(most_active_date) if most_active_date else None,
        "most_active_hours": most_active_hours,
        "longest_streak": streak_data.get("max_streak", 0),
        "current_streak": streak_data.get("current_streak", 0),
    }


def compute_yearly_summary(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"]
    g = tracks.groupby("year").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 1)),
        unique_tracks=("spotify_track_uri", "nunique"),
        unique_artists=("master_metadata_album_artist_name", "nunique"),
    ).reset_index()
    return g


def compute_monthly_summary(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"]
    g = tracks.groupby("yearmonth").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 2)),
        unique_tracks=("spotify_track_uri", "nunique"),
    ).reset_index()
    return g


def compute_daily_summary(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"]
    g = tracks.groupby("date").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 3)),
    ).reset_index()
    g["date"] = g["date"].astype(str)
    return g
