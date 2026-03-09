FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY src/ ./src/
COPY static/ ./static/

ENV DATA_DIR=/data
ENV HOST=0.0.0.0
ENV PORT=8000

VOLUME ["/data"]

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "kemopin.main:app", "--host", "0.0.0.0", "--port", "8000"]
