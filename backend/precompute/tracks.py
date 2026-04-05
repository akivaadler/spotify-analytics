import pandas as pd


def compute_track_max_ms(df: pd.DataFrame) -> dict:
    tracks = df[df["content_type"] == "track"]
    return tracks.groupby("spotify_track_uri")["ms_played"].max().to_dict()


def compute_track_agg(df: pd.DataFrame, track_max_ms: dict) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"].copy()
    tracks["track_max_ms"] = tracks["spotify_track_uri"].map(track_max_ms)
    tracks["completion"] = (tracks["ms_played"] / tracks["track_max_ms"]).clip(upper=1.0)

    g = tracks.groupby("spotify_track_uri").agg(
        track_name=("master_metadata_track_name", "first"),
        artist=("master_metadata_album_artist_name", "first"),
        album=("master_metadata_album_album_name", "first"),
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
        skip_count=("is_skipped", "sum"),
        avg_completion=("completion", "mean"),
        first_played=("ts", "min"),
        last_played=("ts", "max"),
    ).reset_index()

    g["skip_rate"] = (g["skip_count"] / g["play_count"]).round(3)
    g["avg_completion"] = g["avg_completion"].round(3)
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["first_played"] = g["first_played"].dt.date.astype(str)
    g["last_played"] = g["last_played"].dt.date.astype(str)
    return g


def compute_yearly_track_rank(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"].copy()
    tracks["year"] = tracks["ts"].dt.year
    g = (
        tracks.groupby(["year", "spotify_track_uri"])
        .agg(
            track_name=("master_metadata_track_name", "first"),
            artist=("master_metadata_album_artist_name", "first"),
            play_count=("ms_played", "count"),
        )
        .reset_index()
    )
    g["rank"] = g.groupby("year")["play_count"].rank(method="first", ascending=False).astype(int)
    return g[g["rank"] <= 10].sort_values(["year", "rank"])
