import pandas as pd


def compute_artist_agg(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"]
    g = tracks.groupby("master_metadata_album_artist_name").agg(
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
        unique_tracks=("spotify_track_uri", "nunique"),
        unique_albums=("master_metadata_album_album_name", "nunique"),
        skip_count=("is_skipped", "sum"),
        first_played=("ts", "min"),
        last_played=("ts", "max"),
    ).reset_index()
    g.rename(columns={"master_metadata_album_artist_name": "artist"}, inplace=True)
    g["skip_rate"] = (g["skip_count"] / g["play_count"]).round(3)
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["first_played_date"] = g["first_played"].dt.date.astype(str)
    g["last_played_date"] = g["last_played"].dt.date.astype(str)

    # Loyalty score: avg hours per year active
    g["years_active"] = (
        (g["last_played"] - g["first_played"]).dt.days / 365.25
    ).clip(lower=1/12)
    g["loyalty_score"] = (g["total_ms"] / 3_600_000 / g["years_active"]).round(2)

    g.drop(columns=["first_played", "last_played", "years_active"], inplace=True)
    return g


def compute_yearly_artist_rank(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"].copy()
    tracks["year"] = tracks["ts"].dt.year
    g = (
        tracks.groupby(["year", "master_metadata_album_artist_name"])
        .agg(play_count=("ms_played", "count"), total_ms=("ms_played_valid", "sum"))
        .reset_index()
    )
    g.rename(columns={"master_metadata_album_artist_name": "artist"}, inplace=True)
    g["rank"] = g.groupby("year")["play_count"].rank(method="first", ascending=False).astype(int)
    return g[g["rank"] <= 10].sort_values(["year", "rank"])
