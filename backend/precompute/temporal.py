import pandas as pd
import numpy as np
from datetime import date, timedelta


def compute_hour_dow_matrix(df: pd.DataFrame, tz_offset: int = 0) -> pd.DataFrame:
    tracks = df[df["content_type"] == "track"].copy()
    tracks["hour_local"] = (tracks["hour_utc"] + tz_offset) % 24
    matrix = (
        tracks.groupby(["hour_local", "dow"])
        .agg(count=("ms_played", "count"), total_ms=("ms_played_valid", "sum"))
        .reset_index()
    )
    matrix["total_ms"] = matrix["total_ms"].fillna(0).astype(int)
    return matrix


def compute_streak_data(daily_summary: pd.DataFrame) -> dict:
    if daily_summary.empty:
        return {"max_streak": 0, "max_streak_start": None, "max_streak_end": None,
                "current_streak": 0, "total_active_days": 0}

    dates = sorted(pd.to_datetime(daily_summary["date"]).dt.date.tolist())
    today = date.today()

    max_streak = 1
    max_start = dates[0]
    max_end = dates[0]
    cur_streak = 1
    cur_start = dates[0]

    best_start = dates[0]
    best_end = dates[0]

    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            cur_streak += 1
            if cur_streak > max_streak:
                max_streak = cur_streak
                best_start = cur_start
                best_end = dates[i]
        else:
            cur_streak = 1
            cur_start = dates[i]

    # Current streak (ending today or yesterday)
    current = 0
    check = today
    date_set = set(dates)
    while check in date_set:
        current += 1
        check -= timedelta(days=1)
    if current == 0:
        check = today - timedelta(days=1)
        while check in date_set:
            current += 1
            check -= timedelta(days=1)

    return {
        "max_streak": max_streak,
        "max_streak_start": str(best_start),
        "max_streak_end": str(best_end),
        "current_streak": current,
        "total_active_days": len(dates),
    }
