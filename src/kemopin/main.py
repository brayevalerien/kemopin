import hmac
import secrets
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse, Response

from kemopin import config, storage
from kemopin.images import process_image

# Admin tokens: in-memory set, cleared on restart
_admin_tokens: set[str] = set()

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


NOT_FOUND_HTML = (STATIC_DIR / "404.html").read_text()


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException) -> HTMLResponse | JSONResponse:
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return HTMLResponse(NOT_FOUND_HTML, status_code=404)


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

    redirects = storage.load_redirects()
    if body.slug in redirects:
        del redirects[body.slug]
        storage.save_redirects(redirects)

    return board


@app.get("/api/boards/{slug}")
async def get_board(slug: str) -> dict[str, Any]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    board = storage.read_board(slug)
    return board


@app.put("/api/boards/{slug}")
async def save_board(slug: str, body: dict[str, Any]) -> dict[str, str]:
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    storage.save_board(slug, body)
    storage.delete_orphaned_assets(slug, body)
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


def _require_admin(request: Request) -> None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    if token not in _admin_tokens:
        raise HTTPException(status_code=401, detail="Invalid token")


class AdminLoginRequest(BaseModel):
    password: str


@app.post("/api/admin/login")
async def admin_login(body: AdminLoginRequest) -> dict[str, str]:
    if not hmac.compare_digest(body.password, config.ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Wrong password")
    token = secrets.token_hex(32)
    _admin_tokens.add(token)
    return {"token": token}


@app.get("/api/admin/boards")
async def admin_list_boards(request: Request) -> list[dict[str, Any]]:
    _require_admin(request)
    boards = storage.list_boards()
    max_bytes = int(config.MAX_BOARD_SIZE_MB * 1024 * 1024)
    for b in boards:
        b["max_bytes"] = max_bytes
    return boards


@app.delete("/api/admin/boards/{slug}")
async def admin_delete_board(slug: str, request: Request) -> dict[str, str]:
    _require_admin(request)
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    storage.delete_board(slug)
    return {"status": "ok"}


class RenameRequest(BaseModel):
    new_slug: str


@app.post("/api/admin/boards/{slug}/rename")
async def admin_rename_board(slug: str, body: RenameRequest, request: Request) -> dict[str, str]:
    _require_admin(request)
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    if storage.board_exists(body.new_slug):
        raise HTTPException(status_code=409, detail="A board with that slug already exists")
    storage.rename_board(slug, body.new_slug)
    redirects = storage.load_redirects()
    redirects[slug] = body.new_slug
    storage.save_redirects(redirects)
    return {"status": "ok"}


@app.get("/api/admin/boards/{slug}/export")
async def admin_export_board(slug: str, request: Request) -> Response:
    _require_admin(request)
    if not storage.board_exists(slug):
        raise HTTPException(status_code=404, detail="Board not found")
    import json
    data = storage.export_board(slug)
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{slug}.json"'},
    )


@app.post("/api/admin/boards/import")
async def admin_import_board(request: Request) -> dict[str, str]:
    _require_admin(request)
    import json
    body = await request.body()
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if "board" not in data or "slug" not in data["board"]:
        raise HTTPException(status_code=400, detail="Missing board data")
    if storage.board_exists(data["board"]["slug"]):
        raise HTTPException(status_code=409, detail="Board already exists")
    slug = storage.import_board(data)
    return {"status": "ok", "slug": slug}


@app.get("/admin", response_class=HTMLResponse)
async def serve_admin() -> HTMLResponse:
    html_path = STATIC_DIR / "admin.html"
    return HTMLResponse(html_path.read_text())


@app.get("/{slug}", response_class=RedirectResponse)
async def redirect_to_board(slug: str) -> RedirectResponse:
    redirects = storage.load_redirects()
    if slug in redirects:
        target = redirects[slug]
        if storage.board_exists(target):
            return RedirectResponse(url=f"/b/{target}", status_code=301)
        else:
            del redirects[slug]
            storage.save_redirects(redirects)
    return RedirectResponse(url=f"/b/{slug}", status_code=301)
