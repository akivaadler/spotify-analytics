import pandas as pd


def compute_show_agg(df: pd.DataFrame) -> pd.DataFrame:
    pods = df[df["content_type"] == "podcast"]
    if pods.empty:
        return pd.DataFrame(columns=["show", "episode_count", "unique_episodes", "total_ms"])
    g = pods.groupby("episode_show_name").agg(
        episode_count=("ms_played", "count"),
        unique_episodes=("spotify_episode_uri", "nunique"),
        total_ms=("ms_played_valid", "sum"),
        first_played=("ts", "min"),
        last_played=("ts", "max"),
    ).reset_index()
    g.rename(columns={"episode_show_name": "show"}, inplace=True)
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["first_played"] = g["first_played"].dt.date.astype(str)
    g["last_played"] = g["last_played"].dt.date.astype(str)
    return g


def compute_episode_agg(df: pd.DataFrame) -> pd.DataFrame:
    pods = df[df["content_type"] == "podcast"]
    if pods.empty:
        return pd.DataFrame(columns=["episode_uri", "episode_name", "show", "play_count", "total_ms"])
    g = pods.groupby("spotify_episode_uri").agg(
        episode_name=("episode_name", "first"),
        show=("episode_show_name", "first"),
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
    ).reset_index()
    g.rename(columns={"spotify_episode_uri": "episode_uri"}, inplace=True)
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    return g
