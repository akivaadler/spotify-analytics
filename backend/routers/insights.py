import json
import traceback
import textwrap
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from data.store import store
from routers.settings import get_anthropic_key

router = APIRouter(prefix="/insights")


def _require_ready():
    if store.state != "ready":
        raise HTTPException(status_code=503, detail="Data not loaded yet")


# ── Pre-computed metrics ──────────────────────────────────────────────────────

@router.get("")
def list_insights():
    _require_ready()
    if not store.insights:
        raise HTTPException(status_code=503, detail="Insights not computed yet")
    return list(store.insights.values())


@router.get("/{metric_id}")
def get_insight(metric_id: str):
    _require_ready()
    if not store.insights or metric_id not in store.insights:
        raise HTTPException(status_code=404, detail="Metric not found")
    return store.insights[metric_id]


# ── LLM Custom Query ──────────────────────────────────────────────────────────

SCHEMA_DESCRIPTION = """
The DataFrame `df` has these columns (60k+ rows, one row per play event):
- ts: datetime (UTC, timezone-aware)
- ms_played: int (milliseconds played; 0 = aborted)
- ms_played_valid: float (ms_played if > 0, else NaN)
- platform: str (raw platform string)
- platform_family: str ('android','ios','macos','windows','linux','web','partner','unknown')
- device_label: str (cleaned device name)
- conn_country: str (2-letter country code)
- content_type: str ('track','podcast','audiobook','unknown')
- master_metadata_track_name: str | None
- master_metadata_album_artist_name: str | None
- master_metadata_album_album_name: str | None
- spotify_track_uri: str | None
- episode_name: str | None
- episode_show_name: str | None
- reason_start: str ('clickrow','playbtn','trackdone','fwdbtn','backbtn','shuffle','remote','appload', etc.)
- reason_end: str ('trackdone','endplay','fwdbtn','backbtn','unexpected-exit','trackerror', etc.)
- shuffle: bool
- skipped: bool
- offline: bool
- incognito_mode: bool
- is_skipped: bool (enriched: skipped OR ms_played<30000 AND reason_end=='fwdbtn')
- session_id: int (30-min gap session detection)
- year: int
- month: int (1-12)
- date: date
- hour_utc: int (0-23)
- dow: int (0=Monday, 6=Sunday)
- yearmonth: str (e.g. '2023-04')

Helper DataFrames also available:
- track_agg: per-URI aggregations (play_count, total_ms, skip_rate, avg_completion, first_played, last_played)
- artist_agg: per-artist aggregations (play_count, total_ms, unique_tracks, loyalty_score, etc.)
"""

SYSTEM_PROMPT = f"""You are a data analyst writing Python/pandas code to analyze Spotify listening history.

{SCHEMA_DESCRIPTION}

Given a user's question, write Python code that:
1. Uses the DataFrame `df` (and optionally `track_agg`, `artist_agg`) which are already loaded
2. Produces a result stored in a variable called `result`
3. `result` must be either:
   - A list of dicts (for ranked/table results)
   - A dict with keys 'value' and optionally 'data' (for single-value results)
   - A string (for text answers)
4. Import numpy as np and pandas as pd if needed (already available)
5. Keep it concise — no print statements, no plots
6. Handle NaN/None gracefully (use .fillna(), .dropna(), etc.)
7. Always filter to tracks: use df[df['content_type']=='track'] unless the question is about podcasts

Return ONLY the Python code block, no explanation, no markdown fences.
"""


class CustomQueryRequest(BaseModel):
    query: str


class CustomQueryResult(BaseModel):
    query: str
    code: str
    result: object
    error: str | None = None


def _call_claude(query: str) -> str:
    """Call Anthropic API to generate pandas code for the query."""
    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed. Run: pip install anthropic")

    api_key = get_anthropic_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Anthropic API key found. Add one in Settings or start the backend with ANTHROPIC_API_KEY set."
        )

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": query}],
    )
    return message.content[0].text.strip()


def _safe_exec(code: str) -> object:
    """Execute generated pandas code in a restricted namespace."""
    namespace = {
        "df": store.df,
        "track_agg": store.track_agg,
        "artist_agg": store.artist_agg,
        "pd": pd,
        "np": np,
        "result": None,
    }
    # Strip markdown fences if the model included them
    code = code.strip()
    if code.startswith("```"):
        lines = code.split("\n")
        code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    exec(compile(code, "<custom_query>", "exec"), namespace)  # noqa: S102
    return namespace.get("result")


def _serialize(obj):
    """Convert pandas/numpy objects to JSON-serializable form."""
    if isinstance(obj, pd.DataFrame):
        return obj.head(50).to_dict(orient="records")
    if isinstance(obj, pd.Series):
        return obj.head(50).to_dict()
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


@router.post("/custom")
def custom_query(req: CustomQueryRequest):
    _require_ready()

    if not req.query or len(req.query.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query too short")

    code = _call_claude(req.query)

    try:
        raw = _safe_exec(code)
        result = _serialize(raw)
        error = None
    except Exception as e:
        result = None
        error = f"{type(e).__name__}: {e}"

    return {
        "query": req.query,
        "code": code,
        "result": result,
        "error": error,
    }


@router.get("/custom/status")
def llm_status():
    """Returns whether LLM custom queries are available."""
    key = get_anthropic_key()
    return {
        "available": bool(key),
        "message": (
            "Ready" if key
            else "Add your Anthropic API key in Settings to enable custom queries"
        ),
    }
