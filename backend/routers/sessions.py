from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store

router = APIRouter(prefix="/sessions")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("/stats")
def get_session_stats():
    _require_ready()
    df = store.session_stats
    if df.empty:
        return {}
    durations_min = df["duration_ms"] / 60_000
    return {
        "total_sessions": int(len(df)),
        "avg_duration_min": round(float(durations_min.mean()), 1),
        "median_duration_min": round(float(durations_min.median()), 1),
        "avg_plays": round(float(df["play_count"].mean()), 1),
        "longest_session_plays": int(df["play_count"].max()),
        "longest_session_date": str(df.loc[df["play_count"].idxmax(), "start_time"])[:10],
    }


@router.get("/distribution")
def get_distribution():
    _require_ready()
    df = store.session_stats.copy()
    bins = [0, 1, 5, 10, 20, 50, float("inf")]
    labels = ["1", "2–5", "6–10", "11–20", "21–50", "50+"]
    import pandas as pd
    df["bucket"] = pd.cut(df["play_count"], bins=bins, labels=labels, right=True)
    g = df.groupby("bucket").size().reset_index(name="count")
    return g.to_dict(orient="records")


@router.get("/{session_id}")
def get_session(session_id: int):
    _require_ready()
    df = store.df
    rows = df[df["session_id"] == session_id].copy()
    if rows.empty:
        raise HTTPException(status_code=404, detail="Session not found")
    rows = rows.sort_values("ts")
    cols = ["ts", "master_metadata_track_name", "master_metadata_album_artist_name",
            "ms_played", "platform_family", "reason_start", "reason_end", "is_skipped"]
    rows["ts"] = rows["ts"].dt.isoformat()
    return rows[cols].fillna("").to_dict(orient="records")


@router.get("")
def list_sessions(
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    _require_ready()
    df = store.session_stats.copy()
    if year_from:
        df = df[df["start_time"].str[:4].astype(int) >= year_from]
    if year_to:
        df = df[df["start_time"].str[:4].astype(int) <= year_to]
    df = df.sort_values("start_time", ascending=False)
    total = len(df)
    return {"total": total, "items": df.iloc[offset: offset + limit].to_dict(orient="records")}
