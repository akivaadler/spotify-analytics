import os
from pathlib import Path

CACHE_DIR = Path.home() / ".spotify-analytics" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

CORS_ORIGINS = ["http://localhost:3000"]

MAX_UPLOAD_SIZE_MB = 500
SESSION_GAP_MINUTES = 30
