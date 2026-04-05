import json
import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

CONFIG_PATH = Path.home() / ".spotify-analytics" / "config.json"


def _load_config() -> dict:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except Exception:
            pass
    return {}


def _save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def get_anthropic_key() -> str | None:
    """Return API key from env var first, then config file."""
    env_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if env_key:
        return env_key
    return _load_config().get("anthropic_api_key") or None


class SaveKeyRequest(BaseModel):
    api_key: str


@router.get("/api/settings")
def get_settings():
    env_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    file_key = _load_config().get("anthropic_api_key", "")

    def mask(k: str) -> str:
        if not k:
            return ""
        return k[:8] + "•" * (len(k) - 12) + k[-4:] if len(k) > 12 else "•" * len(k)

    return {
        "anthropic_key_source": "env" if env_key else ("file" if file_key else "none"),
        "anthropic_key_masked": mask(env_key or file_key),
        "anthropic_key_set": bool(env_key or file_key),
    }


@router.post("/api/settings/anthropic-key")
def save_anthropic_key(body: SaveKeyRequest):
    key = body.api_key.strip()
    if not key:
        return {"ok": False, "error": "Key cannot be empty"}
    if not key.startswith("sk-"):
        return {"ok": False, "error": "Key should start with 'sk-'"}
    config = _load_config()
    config["anthropic_api_key"] = key
    _save_config(config)
    return {"ok": True}


@router.delete("/api/settings/anthropic-key")
def delete_anthropic_key():
    config = _load_config()
    config.pop("anthropic_api_key", None)
    _save_config(config)
    return {"ok": True}
