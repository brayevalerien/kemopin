import hmac
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from kemopin import config, storage
from kemopin.images import process_image

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exception: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    return {
        "max_history": config.MAX_HISTORY,
        "version": config.VERSION,
    }


@app.get("/b/{slug}", response_class=HTMLResponse)
async def serve_board(slug: str) -> HTMLResponse:
    html_path = STATIC_DIR / "index.html"
    return HTMLResponse(html_path.read_text())


class CreateBoardRequest(BaseModel):
    slug: str
    password: str


@app.post("/api/boards")
async def create_board(body: CreateBoardRequest) -> dict[str, Any]:
    if not hmac.compare_digest(body.password, config.ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Wrong password")

    if storage.board_exists(body.slug):
        raise HTTPException(status_code=409, detail="Board already exists")

    board = storage.create_board(body.slug)
    return board


@app.get("/api/boards/{slug}")
async def get_board(slug: str) -> dict[str, Any]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    board = storage.read_board(slug)
    storage.delete_orphaned_assets(slug, board)
    return board


@app.put("/api/boards/{slug}")
async def save_board(slug: str, body: dict[str, Any]) -> dict[str, str]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    storage.save_board(slug, body)
    return {"status": "ok"}


@app.post("/api/boards/{slug}/assets")
@limiter.limit(config.UPLOAD_RATE_LIMIT)
async def upload_asset(slug: str, request: Request, file: UploadFile) -> dict[str, str]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")

    data = await file.read()
    max_bytes = config.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {config.MAX_FILE_SIZE_MB}MB limit",
        )

    processed, extension = process_image(data)

    board_size = storage.get_board_size_bytes(slug)
    max_board_bytes = config.MAX_BOARD_SIZE_MB * 1024 * 1024
    if board_size + len(processed) > max_board_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Board exceeds {config.MAX_BOARD_SIZE_MB}MB limit",
        )

    filename = storage.store_asset(slug, processed, extension)

    return {"url": f"/api/boards/{slug}/assets/{filename}"}


@app.get("/api/boards/{slug}/size")
async def get_board_size(slug: str) -> dict[str, Any]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    size_bytes = storage.get_board_size_bytes(slug)
    return {
        "size_bytes": size_bytes,
        "max_bytes": config.MAX_BOARD_SIZE_MB * 1024 * 1024,
    }


@app.get("/api/boards/{slug}/assets/{filename}")
async def get_asset(slug: str, filename: str) -> FileResponse:
    path = storage.get_asset_path(slug, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(path)


@app.get("/{slug}", response_class=RedirectResponse)
async def redirect_to_board(slug: str) -> RedirectResponse:
    return RedirectResponse(url=f"/b/{slug}", status_code=301)
