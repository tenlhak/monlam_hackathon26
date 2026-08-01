# MunSel — one image, one process: FastAPI serves the API and the built React app.
#
# Two stages so Node never reaches the runtime image. The frontend is a pile of
# static files once built; shipping node_modules alongside Python would roughly
# triple the image for nothing.

# ---------------------------------------------------------------- build web
FROM node:22-slim AS web

WORKDIR /build

# Manifests first: this layer is cached until a dependency actually changes,
# so editing a component does not reinstall the world.
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build


# ------------------------------------------------------------------ runtime
FROM python:3.11-slim AS runtime

# PYTHONUNBUFFERED so logs reach Railway as they happen rather than when a
# buffer fills — without it a crash can lose the traceback that explains it.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY t_tutor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The application, including the vendored Tibetan font and the curated data
# the tutor is only allowed to teach from.
COPY t_tutor/ ./t_tutor/

# app.py looks for the frontend at ../web/dist relative to itself, so the build
# output has to land at that path rather than anywhere convenient.
COPY --from=web /build/dist ./web/dist

WORKDIR /app/t_tutor

# Where the databases live. Railway mounts a volume here; see tutor/paths.py.
ENV DATA_DIR=/data

EXPOSE 8080

# Shell form on purpose: Railway injects $PORT at runtime and exec form would
# pass the literal string. Bound to 0.0.0.0 because a container's loopback is
# not reachable from outside it.
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}
