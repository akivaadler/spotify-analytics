from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store

router = APIRouter(prefix="/tracks")

SORT_COLS = {"play_count", "total_ms", "skip_rate", "avg_completion"}


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("")
def list_tracks(
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    sort_by: str = "play_count",
    order: str = "desc",
    limit: int = Query(50, le=500),
    offset: int = 0,
    exclude_artists: Optional[str] = None,
):
    _require_ready()
    df = store.track_agg.copy()

    if year_from or year_to:
        raw = store.df[store.df["content_type"] == "track"].copy()
        if year_from:
            raw = raw[raw["year"] >= year_from]
        if year_to:
            raw = raw[raw["year"] <= year_to]
        uris = raw["spotify_track_uri"].unique()
        df = df[df["spotify_track_uri"].isin(uris)]

    if exclude_artists:
        excluded = [a.strip() for a in exclude_artists.split(",")]
        df = df[~df["artist"].isin(excluded)]

    if sort_by not in SORT_COLS:
        sort_by = "play_count"
    df = df.sort_values(sort_by, ascending=(order == "asc"))
    total = len(df)
    df = df.iloc[offset: offset + limit]
    return {"total": total, "items": df.to_dict(orient="records")}


@router.get("/{uri:path}/history")
def track_history(uri: str, year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.df
    rows = df[df["spotify_track_uri"] == uri].copy()
    if year_from:
        rows = rows[rows["year"] >= year_from]
    if year_to:
        rows = rows[rows["year"] <= year_to]
    rows = rows.sort_values("ts")
    cols = ["ts", "ms_played", "platform_family", "reason_start", "reason_end", "is_skipped", "shuffle", "offline"]
    rows["ts"] = rows["ts"].dt.isoformat()
    return rows[cols].to_dict(orient="records")


@router.get("/{uri:path}")
def get_track(uri: str):
    _require_ready()
    agg = store.track_agg
    row = agg[agg["spotify_track_uri"] == uri]
    if row.empty:
        raise HTTPException(status_code=404, detail="Track not found")

    df = store.df
    plays = df[df["spotify_track_uri"] == uri].copy()

    # Monthly play trend
    monthly = plays.groupby("yearmonth").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 3)),
    ).reset_index().to_dict(orient="records")

    # Completion histogram
    track_max = store.track_max_ms.get(uri, 1)
    plays["completion_bucket"] = ((plays["ms_played"] / track_max).clip(0, 1) * 10).astype(int).clip(0, 9)
    completion_hist = plays.groupby("completion_bucket").size().reset_index(name="count").to_dict(orient="records")

    # Platform breakdown
    platform_breakdown = plays.groupby("platform_family").size().reset_index(name="count").to_dict(orient="records")

    result = row.to_dict(orient="records")[0]
    result["monthly_trend"] = monthly
    result["completion_histogram"] = completion_hist
    result["platform_breakdown"] = platform_breakdown
    return result
