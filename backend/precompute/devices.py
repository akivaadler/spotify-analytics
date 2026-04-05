import pandas as pd


def compute_platform_agg(df: pd.DataFrame) -> pd.DataFrame:
    total_ms = df["ms_played_valid"].sum()
    g = df.groupby("platform_family").agg(
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
    ).reset_index()
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["pct_of_total"] = ((g["total_ms"] / total_ms) * 100).round(1) if total_ms else 0
    return g


def compute_device_agg(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby(["platform_family", "device_label"]).agg(
        play_count=("ms_played", "count"),
        total_ms=("ms_played_valid", "sum"),
        first_active=("ts", "min"),
        last_active=("ts", "max"),
    ).reset_index()
    g["total_ms"] = g["total_ms"].fillna(0).astype(int)
    g["first_active"] = g["first_active"].dt.date.astype(str)
    g["last_active"] = g["last_active"].dt.date.astype(str)
    return g
