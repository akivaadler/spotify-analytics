from fastapi import APIRouter, Query, HTTPException
from data.store import store

router = APIRouter(prefix="/search")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


@router.get("")
def search(q: str = Query(..., min_length=2)):
    _require_ready()

    tracks = store.track_agg
    artists = store.artist_agg
    albums = store.album_agg
    shows = store.show_agg

    track_hits = tracks[tracks["track_name"].str.contains(q, case=False, na=False)].head(5)[
        ["spotify_track_uri", "track_name", "artist", "play_count"]
    ].to_dict(orient="records")

    artist_hits = artists[artists["artist"].str.contains(q, case=False, na=False)].head(5)[
        ["artist", "play_count", "total_ms"]
    ].to_dict(orient="records")

    album_hits = albums[albums["album"].str.contains(q, case=False, na=False)].head(5)[
        ["album", "artist", "play_count"]
    ].to_dict(orient="records")

    show_hits = (
        shows[shows["show"].str.contains(q, case=False, na=False)].head(5)[
            ["show", "episode_count", "total_ms"]
        ].to_dict(orient="records")
        if not shows.empty else []
    )

    return {
        "tracks": track_hits,
        "artists": artist_hits,
        "albums": album_hits,
        "shows": show_hits,
    }
