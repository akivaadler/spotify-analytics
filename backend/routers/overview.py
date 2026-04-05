from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from data.store import store

router = APIRouter(prefix="/overview")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


def _filter_yearly(df, year_from, year_to):
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    return df


@router.get("/kpis")
def get_kpis():
    _require_ready()
    return store.kpi_global


@router.get("/yearly")
def get_yearly():
    _require_ready()
    return store.yearly_summary.to_dict(orient="records")


@router.get("/monthly")
def get_monthly(
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
):
    _require_ready()
    df = store.monthly_summary.copy()
    df["year"] = df["yearmonth"].str[:4].astype(int)
    if year_from:
        df = df[df["year"] >= year_from]
    if year_to:
        df = df[df["year"] <= year_to]
    return df.drop(columns=["year"]).to_dict(orient="records")


@router.get("/wrapped/{year}")
def get_wrapped(year: int):
    _require_ready()
    top_artists = store.yearly_artist_rank[store.yearly_artist_rank["year"] == year].to_dict(orient="records")
    top_tracks = store.yearly_track_rank[store.yearly_track_rank["year"] == year].to_dict(orient="records")

    df = store.df
    tracks_year = df[(df["content_type"] == "track") & (df["year"] == year)]
    total_ms = tracks_year["ms_played_valid"].sum()

    # New artists this year
    all_tracks = df[df["content_type"] == "track"]
    artist_first_year = all_tracks.groupby("master_metadata_album_artist_name")["year"].min()
    new_artists = int((artist_first_year == year).sum())

    # Personality
    skip_rate = tracks_year["is_skipped"].mean() if not tracks_year.empty else 0
    shuffle_rate = tracks_year["shuffle"].fillna(False).mean() if not tracks_year.empty else 0
    if skip_rate > 0.4 and shuffle_rate > 0.5:
        personality = "Explorer"
    elif skip_rate < 0.15 and shuffle_rate < 0.3:
        personality = "Deep Listener"
    elif shuffle_rate > 0.6:
        personality = "Shuffler"
    else:
        personality = "Balanced"

    return {
        "year": year,
        "total_hours": round(float(total_ms) / 3_600_000, 1) if total_ms else 0,
        "total_plays": int(len(tracks_year)),
        "new_artists_discovered": new_artists,
        "personality": personality,
        "top_artists": top_artists,
        "top_tracks": top_tracks,
    }
