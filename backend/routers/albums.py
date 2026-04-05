from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store

router = APIRouter(prefix="/albums")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("")
def list_albums(
    sort_by: str = "play_count",
    order: str = "desc",
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    _require_ready()
    df = store.album_agg.copy()
    if sort_by not in {"play_count", "total_ms", "unique_tracks", "skip_rate"}:
        sort_by = "play_count"
    df = df.sort_values(sort_by, ascending=(order == "asc"))
    total = len(df)
    return {"total": total, "items": df.iloc[offset: offset + limit].to_dict(orient="records")}


@router.get("/{album_name}")
def get_album(album_name: str, artist: Optional[str] = None):
    _require_ready()
    df = store.album_agg
    rows = df[df["album"] == album_name]
    if artist:
        rows = rows[rows["artist"] == artist]
    if rows.empty:
        raise HTTPException(status_code=404, detail="Album not found")

    album_row = rows.iloc[0].to_dict()
    tracks = store.track_agg[
        (store.track_agg["album"] == album_name) &
        (store.track_agg["artist"] == album_row["artist"])
    ].sort_values("play_count", ascending=False).to_dict(orient="records")

    album_row["tracks"] = tracks
    return album_row
