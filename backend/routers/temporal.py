from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store
from precompute.temporal import compute_hour_dow_matrix

router = APIRouter(prefix="/temporal")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("/heatmap")
def get_heatmap(tz_offset: int = Query(0, ge=-12, le=14), metric: str = "count"):
    _require_ready()
    df = store.df
    matrix = compute_hour_dow_matrix(df, tz_offset)
    return matrix.to_dict(orient="records")


@router.get("/calendar")
def get_calendar(year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.daily_summary.copy()
    df["year"] = df["date"].str[:4].astype(int)
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    return df.drop(columns=["year"]).to_dict(orient="records")


@router.get("/hourly")
def get_hourly(tz_offset: int = Query(0, ge=-12, le=14), year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.df[store.df["content_type"] == "track"].copy()
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    df["hour_local"] = (df["hour_utc"] + tz_offset) % 24
    g = df.groupby("hour_local").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 2)),
    ).reset_index()
    return g.to_dict(orient="records")


@router.get("/weekly")
def get_weekly(year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.df[store.df["content_type"] == "track"].copy()
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    g = df.groupby("dow").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 2)),
    ).reset_index()
    DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    g["day_name"] = g["dow"].map(lambda d: DOW_NAMES[d])
    return g.to_dict(orient="records")


@router.get("/monthly-pattern")
def get_monthly_pattern(year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.df[store.df["content_type"] == "track"].copy()
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    g = df.groupby("month").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 2)),
    ).reset_index()
    MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    g["month_name"] = g["month"].map(lambda m: MONTH_NAMES[m - 1])
    return g.to_dict(orient="records")


@router.get("/streaks")
def get_streaks():
    _require_ready()
    return store.streak_data
