from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store

router = APIRouter(prefix="/artists")

SORT_COLS = {"play_count", "total_ms", "unique_tracks", "skip_rate", "loyalty_score"}


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("")
def list_artists(
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    sort_by: str = "play_count",
    order: str = "desc",
    limit: int = Query(50, le=500),
    offset: int = 0,
    exclude_artists: Optional[str] = None,
):
    _require_ready()
    df = store.artist_agg.copy()

    if year_from or year_to:
        raw = store.df[store.df["content_type"] == "track"].copy()
        if year_from:
            raw = raw[raw["year"] >= year_from]
        if year_to:
            raw = raw[raw["year"] <= year_to]
        artists = raw["master_metadata_album_artist_name"].unique()
        df = df[df["artist"].isin(artists)]

    if exclude_artists:
        excluded = [a.strip() for a in exclude_artists.split(",")]
        df = df[~df["artist"].isin(excluded)]

    if sort_by not in SORT_COLS:
        sort_by = "play_count"
    df = df.sort_values(sort_by, ascending=(order == "asc"))
    total = len(df)
    return {"total": total, "items": df.iloc[offset: offset + limit].to_dict(orient="records")}


@router.get("/{name}/timeline")
def artist_timeline(name: str):
    _require_ready()
    df = store.df
    plays = df[(df["content_type"] == "track") & (df["master_metadata_album_artist_name"] == name)]
    if plays.empty:
        raise HTTPException(status_code=404, detail="Artist not found")
    monthly = plays.groupby("yearmonth").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 3)),
    ).reset_index()
    return monthly.to_dict(orient="records")


@router.get("/{name}/tracks")
def artist_tracks(name: str, sort_by: str = "play_count", limit: int = Query(50, le=200)):
    _require_ready()
    df = store.track_agg[store.track_agg["artist"] == name].copy()
    if df.empty:
        raise HTTPException(status_code=404, detail="Artist not found")
    if sort_by not in {"play_count", "total_ms", "skip_rate", "avg_completion"}:
        sort_by = "play_count"
    df = df.sort_values(sort_by, ascending=False).head(limit)
    return df.to_dict(orient="records")


@router.get("/{name}")
def get_artist(name: str):
    _require_ready()
    agg = store.artist_agg
    row = agg[agg["artist"] == name]
    if row.empty:
        raise HTTPException(status_code=404, detail="Artist not found")

    df = store.df
    plays = df[(df["content_type"] == "track") & (df["master_metadata_album_artist_name"] == name)]

    # YoY
    yoy = plays.groupby("year").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 2)),
    ).reset_index().to_dict(orient="records")

    # Top tracks
    top_tracks = (
        store.track_agg[store.track_agg["artist"] == name]
        .nlargest(10, "play_count")
        .to_dict(orient="records")
    )

    result = row.to_dict(orient="records")[0]
    result["yoy"] = yoy
    result["top_tracks"] = top_tracks
    result["skip_rate_pct"] = round(result.get("skip_rate", 0) * 100, 1)
    result["offline_rate_pct"] = round(float(plays["offline"].fillna(False).mean()) * 100, 1)
    result["shuffle_rate_pct"] = round(float(plays["shuffle"].fillna(False).mean()) * 100, 1)
    return result
