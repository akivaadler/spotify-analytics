"""
Full data processing pipeline: load → enrich → precompute → populate store.
Run in a background thread after upload.
"""
import threading
from typing import List

from data.store import store
from data.loader import load_from_bytes
from data.enricher import enrich
from precompute.overview import compute_kpi_global, compute_yearly_summary, compute_monthly_summary, compute_daily_summary
from precompute.temporal import compute_hour_dow_matrix, compute_streak_data
from precompute.tracks import compute_track_max_ms, compute_track_agg, compute_yearly_track_rank
from precompute.artists import compute_artist_agg, compute_yearly_artist_rank
from precompute.albums import compute_album_agg
from precompute.sessions import compute_session_stats
from precompute.podcasts import compute_show_agg, compute_episode_agg
from precompute.devices import compute_platform_agg, compute_device_agg


_lock = threading.Lock()


def run_pipeline(file_bytes_list: List[bytes]):
    with _lock:
        try:
            store.clear()
            store.state = "processing"
            store.progress_pct = 5

            df_raw = load_from_bytes(file_bytes_list)
            store.progress_pct = 15

            df = enrich(df_raw)
            store.df = df
            store.records_loaded = len(df)
            store.progress_pct = 25

            store.track_max_ms = compute_track_max_ms(df)
            store.progress_pct = 30

            store.track_agg = compute_track_agg(df, store.track_max_ms)
            store.progress_pct = 40

            store.artist_agg = compute_artist_agg(df)
            store.progress_pct = 50

            store.album_agg = compute_album_agg(df)
            store.progress_pct = 55

            store.yearly_summary = compute_yearly_summary(df)  # streak populated below
            store.monthly_summary = compute_monthly_summary(df)
            store.daily_summary = compute_daily_summary(df)
            store.progress_pct = 65

            store.hour_dow_matrix = compute_hour_dow_matrix(df)
            streak = compute_streak_data(store.daily_summary)
            store.streak_data = streak
            store.progress_pct = 70

            store.kpi_global = compute_kpi_global(df, streak)
            # Re-compute yearly_summary properly
            store.yearly_summary = compute_yearly_summary(df)
            store.progress_pct = 75

            store.session_stats = compute_session_stats(df)
            store.progress_pct = 85

            store.show_agg = compute_show_agg(df)
            store.episode_agg = compute_episode_agg(df)
            store.progress_pct = 88

            store.platform_agg = compute_platform_agg(df)
            store.device_agg = compute_device_agg(df)
            store.progress_pct = 92

            store.yearly_artist_rank = compute_yearly_artist_rank(df)
            store.yearly_track_rank = compute_yearly_track_rank(df)
            store.progress_pct = 98

            store.state = "ready"
            store.progress_pct = 100

        except Exception as e:
            store.state = "idle"
            store.error = str(e)
            raise
