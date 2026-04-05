import pandas as pd


def compute_session_stats(df: pd.DataFrame) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"].copy()
    if tracks.empty:
        return pd.DataFrame()

    def session_agg(g):
        top_artist = (
            g["master_metadata_album_artist_name"].value_counts().idxmax()
            if not g["master_metadata_album_artist_name"].dropna().empty else None
        )
        return pd.Series({
            "start_time": g["ts"].min().isoformat(),
            "end_time": g["ts"].max().isoformat(),
            "duration_ms": int((g["ts"].max() - g["ts"].min()).total_seconds() * 1000 + g["ms_played"].iloc[-1]),
            "play_count": len(g),
            "top_artist": top_artist,
            "platform_family": g["platform_family"].mode().iloc[0] if not g["platform_family"].empty else None,
        })

    stats = tracks.groupby("session_id").apply(session_agg).reset_index()
    return stats
