import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from kemopin.config import DATA_DIR


def board_directory(slug: str) -> Path:
    return DATA_DIR / "boards" / slug


def board_json_path(slug: str) -> Path:
    return board_directory(slug) / "board.json"


def assets_directory(slug: str) -> Path:
    return board_directory(slug) / "assets"


def board_exists(slug: str) -> bool:
    return board_json_path(slug).is_file()


def create_board(slug: str) -> dict[str, Any]:
    board_directory(slug).mkdir(parents=True, exist_ok=False)
    assets_directory(slug).mkdir()

    board = {
        "slug": slug,
        "created": datetime.now(timezone.utc).isoformat(),
        "canvas": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1},
        "elements": [],
    }
    board_json_path(slug).write_text(json.dumps(board, indent=2))
    return board


def read_board(slug: str) -> dict[str, Any]:
    return json.loads(board_json_path(slug).read_text())


def save_board(slug: str, data: dict[str, Any]) -> None:
    board_json_path(slug).write_text(json.dumps(data, indent=2))


def get_board_size_bytes(slug: str) -> int:
    total = 0
    for file in board_directory(slug).rglob("*"):
        if file.is_file():
            total += file.stat().st_size
    return total


def store_asset(slug: str, data: bytes, extension: str) -> str:
    filename = f"{uuid.uuid4().hex}{extension}"
    destination = assets_directory(slug) / filename
    destination.write_bytes(data)
    return filename


def get_asset_path(slug: str, filename: str) -> Path | None:
    path = assets_directory(slug) / filename
    if path.is_file():
        return path
    return None
