import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import CORS_ORIGINS
from data.store import store

from routers.upload import router as upload_router
from routers.overview import router as overview_router
from routers.tracks import router as tracks_router
from routers.artists import router as artists_router
from routers.albums import router as albums_router
from routers.temporal import router as temporal_router
from routers.sessions import router as sessions_router
from routers.podcasts import router as podcasts_router
from routers.devices import router as devices_router
from routers.search import router as search_router

_start_time = time.time()

app = FastAPI(title="Spotify Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api")
app.include_router(overview_router, prefix="/api")
app.include_router(tracks_router, prefix="/api")
app.include_router(artists_router, prefix="/api")
app.include_router(albums_router, prefix="/api")
app.include_router(temporal_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(podcasts_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "data_loaded": store.state == "ready",
        "records_loaded": store.records_loaded,
        "uptime_s": round(time.time() - _start_time, 1),
    }


@app.get("/api/meta")
def meta():
    if store.state != "ready":
        return {"state": store.state}
    df = store.df
    years = sorted(df["year"].unique().tolist())
    return {
        "date_start": store.kpi_global["date_start"],
        "date_end": store.kpi_global["date_end"],
        "years_available": [int(y) for y in years],
        "content_type_counts": df["content_type"].value_counts().to_dict(),
        "platform_counts": df["platform_family"].value_counts().to_dict(),
    }
