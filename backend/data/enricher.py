import re
import pandas as pd
from config import SESSION_GAP_MINUTES


PLATFORM_PATTERNS = [
    (r"(?i)android", "android"),
    (r"(?i)\biOS\b|iPhone|iPad", "ios"),
    (r"(?i)macOS|Mac OS", "macos"),
    (r"(?i)Windows", "windows"),
    (r"(?i)Linux", "linux"),
    (r"(?i)web_player|Web Player|browser", "web"),
    (r"(?i)Partner", "partner"),
]


def _classify_platform(p: str) -> str:
    if not isinstance(p, str):
        return "unknown"
    for pattern, label in PLATFORM_PATTERNS:
        if re.search(pattern, p):
            return label
    return "unknown"


def _extract_device_label(p: str) -> str:
    if not isinstance(p, str) or p in ("", "not_applicable"):
        return "Unknown"
    # Strip OS version boilerplate and return a cleaned label
    p = re.sub(r"OS \d+[\d.]*( API \d+)?", "", p).strip(" ,;()")
    p = re.sub(r"\s+", " ", p)
    return p[:80] if p else "Unknown"


def _detect_content_type(row) -> str:
    if pd.notna(row.get("spotify_track_uri")):
        return "track"
    if pd.notna(row.get("spotify_episode_uri")):
        return "podcast"
    if pd.notna(row.get("audiobook_uri")):
        return "audiobook"
    return "unknown"


def _assign_sessions(df: pd.DataFrame, gap_minutes: int) -> pd.Series:
    """Assign an integer session_id based on time gaps between plays."""
    gap = pd.Timedelta(minutes=gap_minutes)
    diffs = df["ts"].diff()
    new_session = (diffs > gap) | diffs.isna()
    return new_session.cumsum().astype(int)


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Content type
    df["content_type"] = df.apply(_detect_content_type, axis=1)

    # Platform
    df["platform_family"] = df["platform"].apply(_classify_platform)
    df["device_label"] = df["platform"].apply(_extract_device_label)

    # Temporal
    df["year"] = df["ts"].dt.year
    df["month"] = df["ts"].dt.month
    df["date"] = df["ts"].dt.date
    df["hour_utc"] = df["ts"].dt.hour
    df["dow"] = df["ts"].dt.dayofweek  # 0=Monday
    df["yearmonth"] = df["ts"].dt.tz_convert(None).dt.to_period("M").astype(str)

    # ms_played validity
    df["ms_played_valid"] = df["ms_played"].where(df["ms_played"] > 0)

    # Enriched skip flag
    df["is_skipped"] = df["skipped"].fillna(False) | (
        (df["ms_played"] < 30_000) & (df["reason_end"] == "fwdbtn")
    )

    # Session IDs
    df["session_id"] = _assign_sessions(df, SESSION_GAP_MINUTES)

    return df
