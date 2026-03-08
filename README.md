# Kemopin
Kemopin is a minimal self-hosted freeform moodboard. Paste images and text on an infinite canvas and share boards by URL slug. No auth needed to view or edit boards, only board creation requires a password.

## Installation
> [!NOTE]
> The following prerequisites are needed before installing Kemopin.
> - [Python](https://www.python.org/) 3.12+
> - [uv](https://docs.astral.sh/uv/)

Clone this repo and `cd` into it:
```sh
git clone https://github.com/brayevalerien/kemopin
cd kemopin
```

Install the project dependencies:
```sh
uv sync
```

Copy the example environment file and set your admin password:
```sh
cp .env.example .env
```

Edit the `.env` file and set `ADMIN_PASSWORD` to a password of your choice. The other variables have sensible defaults, see `.env.example` for details.

## Usage
Start the server:
```sh
uv run uvicorn kemopin.main:app
```

Navigate to `/b/your-board-name` to create or open a board. Creating a board will prompt for the admin password you configured.
