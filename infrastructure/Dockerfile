# Shelfmark's API (Fastify + SQLite).
#
# Build context is the REPO ROOT (one root lockfile covers shared, server and
# web). Multi-stage: the TypeScript compiler and the native build toolchain live
# in build stages and never reach the runtime image. The web app is a static
# site that vps-deploy builds and ships separately; it is not in this image.
#
# The runtime stages are Debian (glibc), not Alpine (musl): the Similar
# recommendations run all-MiniLM-L6-v2 through transformers.js, whose
# onnxruntime-node ships Linux binaries for glibc only, and on Alpine its import
# fails ("ld-linux-x86-64.so.2"). The compile stages stay on Alpine; they only
# run tsc. onnxruntime-node's postinstall (which would fetch the CUDA and
# TensorRT providers) is denied in package.json's allowScripts.
#
#   docker compose -f infrastructure/docker-compose.yml up shelfmark-api
#
# ── Why this container runs as root ─────────────────────────────────────────
#
# It looks alarming and is not. On the VPS this runs under a ROOTLESS Docker
# daemon owned by an unprivileged account, where the container's uid 0 maps to
# that account's own uid on the host — so "root" here is already a normal
# unprivileged user out there, and a container escape lands on an account with
# no sudo and no docker group.
#
# It has to be uid 0 specifically because /data is a BIND MOUNT of the host's
# /srv/shelfmark-api/data, which holds the book database. Under rootless
# Docker only container-root maps back to the owning account; a non-root
# in-container user maps to a subuid the host sees as a stranger, and the
# service could not write its own database.

# ---------------------------------------------------------------------------
# deps — full workspace install, with the toolchain native modules may need
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
# better-sqlite3 13 ships Node-API prebuilds including linuxmusl-x64, so this is
# a fallback rather than the normal path — but a version bump that drops the
# musl prebuild would otherwise fail the build with a cryptic node-gyp error.
RUN apk add --no-cache python3 make g++
WORKDIR /app
# Manifests first, for layer caching: one root lockfile, one npm ci. Every
# workspace manifest is needed because `npm ci` validates the lockfile against
# every workspace the root package.json declares and bails on a missing one.
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

# ---------------------------------------------------------------------------
# builder — compile shared and the server (tsc -b → shared/dist, server/dist)
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY shared ./shared
COPY server ./server
# server/tsconfig.json references shared, so this builds both, in order.
RUN npx tsc -b server

# ---------------------------------------------------------------------------
# proddeps — runtime dependencies only, native modules built here
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS proddeps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
# Scoped to the server workspace: unscoped this would also install whatever the
# web app grows (React and its tree), which the server never runs.
RUN npm ci --omit=dev -w @shelfmark/server --include-workspace-root
# Drop native build intermediates and the prebuilds for operating systems this
# image can never be.
#
# Deliberately a BLACKLIST of foreign platforms rather than a whitelist of the
# ones to keep: better-sqlite3 ships prebuilds as FILES
# (`prebuilds/linuxmusl-x64.node`), not directories, and a whitelist written
# against bare names silently deletes all of them, leaving an image that builds
# clean and crash-loops on a missing better_sqlite3.node.
#
# onnxruntime-node ships every platform's binaries (about 290 MB); only this
# image's own Linux architecture stays. onnxruntime-web comes with
# transformers.js but never runs in Node: its WebAssembly builds (about 90 MB)
# and source maps (about 20 MB) go, its JavaScript stays because transformers.js
# imports it.
RUN cd node_modules \
 && find . -name '*.o' -delete \
 && find . -type d -name obj.target -prune -exec rm -rf {} + \
 && rm -rf better-sqlite3/deps better-sqlite3/src \
 && find . -type d -name prebuilds -exec sh -c \
      'rm -f "$1"/darwin-*.node "$1"/win32-*.node "$1"/android-*.node' _ {} \; \
 && rm -rf onnxruntime-node/bin/napi-v6/darwin onnxruntime-node/bin/napi-v6/win32 \
 && arch="$(node -p process.arch)" \
 && find onnxruntime-node/bin/napi-v6/linux -mindepth 1 -maxdepth 1 ! -name "$arch" -exec rm -rf {} + \
 && find onnxruntime-web \( -name '*.wasm' -o -name '*.map' \) -delete

# ---------------------------------------------------------------------------
# prod — slim runtime: no compiler, no test code, no TypeScript
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS prod
LABEL org.opencontainers.image.title="Shelfmark" \
      org.opencontainers.image.description="Shelfmark API: the book catalog"
# pdftotext, for the CIP index's weekly refresh (server/src/features/lookup/cip/refresh.ts).
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=proddeps /app/node_modules ./node_modules
COPY package.json ./
# node_modules/@shelfmark/shared is a symlink to ../shared, so shared must sit at
# /app/shared with its manifest and compiled output.
COPY shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY server/vendor ./server/vendor
# tsc compiles src/**/* including the tests. They import a runner that
# --omit=dev never installed, so shipping them is dead weight.
RUN find ./server/dist ./shared/dist \( -name '*.test.js' -o -name '*.test.js.map' -o -name '*.test.d.ts' \) -delete
# MALLOC_ARENA_MAX: glibc gives each thread that allocates its own malloc arena and
# keeps them, so the API's resident memory grows with every burst of outbound
# requests (decompression runs on libuv's threads); two arenas bound that, the
# common setting for Node on glibc. Measured 2026-11-23: 13 Open Library searches
# grew the process by 46 MB with the default, 31 MB with 2.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8796 \
    DATA_DIR=/data \
    MALLOC_ARENA_MAX=2
# The book database and covers (shelfmark.db), and the model's files (models/, 23 MB,
# downloaded on the first Similar refresh). A BIND MOUNT on the VPS (the host's
# /srv/shelfmark-api/data), so it survives every deploy.
VOLUME /data
EXPOSE 8796
# Shell form, so it follows the runtime PORT rather than a baked constant. Node's own
# fetch: the Debian image has no wget or curl, and installing one for this is a package more.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:${PORT}/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/dist/server.js"]
