import io
import pandas as pd
from typing import List


REQUIRED_FIELDS = {"ts", "ms_played"}


def load_from_bytes(file_bytes_list: List[bytes]) -> pd.DataFrame:
    """Parse a list of raw JSON file bytes and concat into a single DataFrame."""
    frames = []
    for raw in file_bytes_list:
        try:
            df = pd.read_json(io.BytesIO(raw), orient="records")
        except Exception as e:
            raise ValueError(f"Failed to parse JSON: {e}")
        missing = REQUIRED_FIELDS - set(df.columns)
        if missing:
            raise ValueError(
                f"File does not look like Spotify streaming history — missing fields: {missing}"
            )
        frames.append(df)

    if not frames:
        raise ValueError("No valid files provided")

    df = pd.concat(frames, ignore_index=True)
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    df = df.sort_values("ts").reset_index(drop=True)
    return df
