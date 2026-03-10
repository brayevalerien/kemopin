import os
from importlib.metadata import version, PackageNotFoundError
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


try:
    VERSION: str = version("kemopin")
except PackageNotFoundError:
    VERSION: str = "dev"

ADMIN_PASSWORD: str = _require_env("ADMIN_PASSWORD")
DATA_DIR: Path = Path(os.environ.get("DATA_DIR", "./data"))
MAX_FILE_SIZE_MB: int = int(os.environ.get("MAX_FILE_SIZE_MB", "5"))
MAX_BOARD_SIZE_MB: int = int(os.environ.get("MAX_BOARD_SIZE_MB", "100"))
MAX_HISTORY: int = int(os.environ.get("MAX_HISTORY", "50"))
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", "8000"))
