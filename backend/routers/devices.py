from fastapi import APIRouter, Query
from typing import Optional
from data.store import store
from fastapi import HTTPException

router = APIRouter(prefix="/devices")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("")
def list_devices():
    _require_ready()
    devices = store.device_agg.sort_values("play_count", ascending=False).to_dict(orient="records")
    platforms = store.platform_agg.sort_values("play_count", ascending=False).to_dict(orient="records")

    # Top artists per platform family
    df = store.df[store.df["content_type"] == "track"]
    top_by_platform = {}
    for pf in df["platform_family"].unique():
        sub = df[df["platform_family"] == pf]
        top = (
            sub.groupby("master_metadata_album_artist_name")["ms_played_valid"]
            .sum()
            .nlargest(5)
            .reset_index()
        )
        top.columns = ["artist", "total_ms"]
        top_by_platform[pf] = top.to_dict(orient="records")

    return {"platforms": platforms, "devices": devices, "top_artists_by_platform": top_by_platform}


@router.get("/timeline")
def get_timeline(year_from: Optional[int] = None, year_to: Optional[int] = None):
    _require_ready()
    df = store.df.copy()
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    g = df.groupby(["yearmonth", "platform_family"]).agg(
        plays=("ms_played", "count"),
    ).reset_index()
    return g.to_dict(orient="records")
