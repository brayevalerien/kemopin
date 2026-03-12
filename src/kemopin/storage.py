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


def delete_orphaned_assets(slug: str, board: dict[str, Any]) -> None:
    referenced = {
        Path(el["src"]).name
        for el in board.get("elements", [])
        if el.get("type") == "image" and "src" in el
    }
    for path in assets_directory(slug).iterdir():
        if path.is_file() and path.name not in referenced:
            path.unlink()


def get_asset_path(slug: str, filename: str) -> Path | None:
    path = assets_directory(slug) / filename
    if path.is_file():
        return path
    return None


def list_boards() -> list[dict[str, Any]]:
    boards_dir = DATA_DIR / "boards"
    if not boards_dir.exists():
        return []
    result = []
    for path in sorted(boards_dir.iterdir()):
        json_path = path / "board.json"
        if not json_path.is_file():
            continue
        board = json.loads(json_path.read_text())
        size_bytes = get_board_size_bytes(board["slug"])
        result.append({
            "slug": board["slug"],
            "created": board.get("created"),
            "element_count": len(board.get("elements", [])),
            "size_bytes": size_bytes,
        })
    return result


def delete_board(slug: str) -> None:
    import shutil
    board_dir = board_directory(slug)
    if board_dir.exists():
        shutil.rmtree(board_dir)


def rename_board(old_slug: str, new_slug: str) -> None:
    old_dir = board_directory(old_slug)
    new_dir = board_directory(new_slug)
    old_dir.rename(new_dir)
    board = json.loads(board_json_path(new_slug).read_text())
    board["slug"] = new_slug
    for el in board.get("elements", []):
        if el.get("type") == "image" and "src" in el:
            el["src"] = el["src"].replace(f"/api/boards/{old_slug}/", f"/api/boards/{new_slug}/")
    board_json_path(new_slug).write_text(json.dumps(board, indent=2))


def export_board(slug: str) -> dict[str, Any]:
    board = read_board(slug)
    assets = {}
    for path in assets_directory(slug).iterdir():
        if path.is_file():
            import base64
            assets[path.name] = base64.b64encode(path.read_bytes()).decode()
    return {"board": board, "assets": assets}


def import_board(data: dict[str, Any]) -> str:
    import base64
    board = data["board"]
    slug = board["slug"]
    board_directory(slug).mkdir(parents=True, exist_ok=False)
    assets_directory(slug).mkdir()
    board_json_path(slug).write_text(json.dumps(board, indent=2))
    for filename, b64data in data.get("assets", {}).items():
        (assets_directory(slug) / filename).write_bytes(base64.b64decode(b64data))
    return slug


REDIRECTS_FILE = DATA_DIR / "redirects.json"


def load_redirects() -> dict[str, str]:
    if REDIRECTS_FILE.is_file():
        return json.loads(REDIRECTS_FILE.read_text())
    return {}


def save_redirects(redirects: dict[str, str]) -> None:
    REDIRECTS_FILE.write_text(json.dumps(redirects, indent=2))
