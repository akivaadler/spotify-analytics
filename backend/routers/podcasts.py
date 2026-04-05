from fastapi import APIRouter, HTTPException, Query
from data.store import store

router = APIRouter(prefix="/podcasts")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("/stats")
def get_podcast_stats():
    _require_ready()
    df = store.df
    pods = df[df["content_type"] == "podcast"]
    total_ms = pods["ms_played_valid"].sum()
    return {
        "total_shows": int(pods["episode_show_name"].nunique()),
        "total_episodes_played": int(len(pods)),
        "total_hours": round(float(total_ms) / 3_600_000, 1) if total_ms else 0,
        "unique_episodes": int(pods["spotify_episode_uri"].nunique()),
    }


@router.get("/shows/{show_name}")
def get_show(show_name: str):
    _require_ready()
    df = store.df
    pods = df[(df["content_type"] == "podcast") & (df["episode_show_name"] == show_name)]
    if pods.empty:
        raise HTTPException(status_code=404, detail="Show not found")

    monthly = pods.groupby("yearmonth").agg(
        plays=("ms_played", "count"),
        hours=("ms_played_valid", lambda x: round(x.sum() / 3_600_000, 3)),
    ).reset_index().to_dict(orient="records")

    episodes = store.episode_agg[store.episode_agg["show"] == show_name].to_dict(orient="records")

    show_row = store.show_agg[store.show_agg["show"] == show_name].to_dict(orient="records")
    result = show_row[0] if show_row else {"show": show_name}
    result["monthly_trend"] = monthly
    result["episodes"] = episodes
    return result


@router.get("/shows")
def list_shows(
    sort_by: str = "total_ms",
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    _require_ready()
    df = store.show_agg.copy()
    if df.empty:
        return {"total": 0, "items": []}
    if sort_by not in {"total_ms", "episode_count", "unique_episodes"}:
        sort_by = "total_ms"
    df = df.sort_values(sort_by, ascending=False)
    total = len(df)
    return {"total": total, "items": df.iloc[offset: offset + limit].to_dict(orient="records")}
