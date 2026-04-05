"""
AppStore: singleton holding the enriched DataFrame and all pre-computed tables.
Call build() after upload to populate. Call clear() to reset.
"""
import pandas as pd
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class AppStore:
    # Raw enriched frame
    df: Optional[pd.DataFrame] = None

    # Pre-computed tables
    track_max_ms: Optional[dict] = None
    track_agg: Optional[pd.DataFrame] = None
    artist_agg: Optional[pd.DataFrame] = None
    album_agg: Optional[pd.DataFrame] = None
    kpi_global: Optional[dict] = None
    yearly_summary: Optional[pd.DataFrame] = None
    monthly_summary: Optional[pd.DataFrame] = None
    daily_summary: Optional[pd.DataFrame] = None
    hour_dow_matrix: Optional[pd.DataFrame] = None
    session_stats: Optional[pd.DataFrame] = None
    show_agg: Optional[pd.DataFrame] = None
    episode_agg: Optional[pd.DataFrame] = None
    platform_agg: Optional[pd.DataFrame] = None
    device_agg: Optional[pd.DataFrame] = None
    yearly_artist_rank: Optional[pd.DataFrame] = None
    yearly_track_rank: Optional[pd.DataFrame] = None
    streak_data: Optional[dict] = None

    # Status
    state: str = "idle"  # idle | processing | ready
    progress_pct: int = 0
    records_loaded: int = 0
    error: Optional[str] = None

    def clear(self):
        for f in self.__dataclass_fields__:
            if f not in ("state", "progress_pct", "records_loaded", "error"):
                setattr(self, f, None)
        self.state = "idle"
        self.progress_pct = 0
        self.records_loaded = 0
        self.error = None


store = AppStore()
