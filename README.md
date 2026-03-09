# Kemopin

Kemopin is a minimal self-hosted freeform moodboard. Paste images and text on an infinite canvas and share boards by URL slug. No auth needed to view or edit boards — only board creation requires a password.

## Usage

Navigate to `/b/your-board-name`. If the board doesn't exist yet, you'll be prompted for the admin password to create it. Once created, anyone with the URL can view and edit it.

**Canvas controls:**

- double-click: add text
- middle click: upload image
- paste / drag & drop: add image
- `C`: change color
- `A`: align
- `Del`: delete selected element

## Running with Docker (recommended)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/)

```sh
git clone https://github.com/brayevalerien/kemopin
cd kemopin
cp .env.example .env
```

Edit `.env` and set `ADMIN_PASSWORD` to a password of your choice, then:

```sh
docker compose up -d
```

Kemopin is now running at `http://localhost:8000`.

## Running locally (dev)

**Prerequisites:** [Python](https://www.python.org/) 3.12+, [uv](https://docs.astral.sh/uv/)

```sh
git clone https://github.com/brayevalerien/kemopin
cd kemopin
uv sync
cp .env.example .env
```

Edit `.env` and set `ADMIN_PASSWORD`, then:

```sh
uv run uvicorn kemopin.main:app --reload
```

Kemopin is now running at `http://localhost:8000`.

## Deploying behind a reverse proxy

To expose Kemopin publicly with a custom domain, put it behind a reverse proxy like Caddy or nginx.

If Caddy runs on the host:

```
pin.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

If Caddy runs as a container in the same Docker Compose stack, add kemopin as a service and proxy to it by service name:

```yaml
services:
  kemopin:
    build: /path/to/kemopin
    restart: always
    environment:
      ADMIN_PASSWORD: yourpassword
      DATA_DIR: /data
    volumes:
      - kemopin_data:/data

volumes:
  kemopin_data:
```

```
pin.example.com {
    reverse_proxy kemopin:8000
}
```

## Configuration

All configuration is done via environment variables (or a `.env` file):

| Variable            | Default   | Description                                      |
| ------------------- | --------- | ------------------------------------------------ |
| `ADMIN_PASSWORD`    | required  | Password to create new boards                    |
| `DATA_DIR`          | `./data`  | Directory where board data and assets are stored |
| `MAX_FILE_SIZE_MB`  | `5`       | Maximum size per uploaded image                  |
| `MAX_BOARD_SIZE_MB` | `100`     | Maximum total size per board                     |
| `HOST`              | `0.0.0.0` | Host to bind to                                  |
| `PORT`              | `8000`    | Port to listen on                                |
