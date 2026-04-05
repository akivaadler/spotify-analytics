import pandas as pd


def compute_album_agg(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"]
    g = tracks.groupby(["master_metadata_album_album_name", "master_metadata_album_artist_name"]).agg(
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
        unique_tracks=("spotify_track_uri", "nunique"),
        skip_count=("is_skipped", "sum"),
        first_played=("ts", "min"),
    ).reset_index()
    g.rename(columns={
        "master_metadata_album_album_name": "album",
        "master_metadata_album_artist_name": "artist",
    }, inplace=True)
    g["skip_rate"] = (g["skip_count"] / g["play_count"]).round(3)
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["first_played"] = g["first_played"].dt.date.astype(str)
    return g
