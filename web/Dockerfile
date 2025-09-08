# ---------- base ----------
FROM node:22-alpine3.21 AS base
LABEL maintainer="takatost@gmail.com"

# Tools & certs
RUN apk add --no-cache tzdata ca-certificates curl bash && update-ca-certificates
RUN corepack enable

# Env for pnpm + DNS behavior
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
# More resilient pnpm networking on flaky links
ENV PNPM_FETCH_RETRIES=6 \
    PNPM_FETCH_RETRY_FACTOR=2 \
    PNPM_FETCH_RETRY_MINTIMEOUT=30000 \
    PNPM_NETWORK_CONCURRENCY=1 \
    PNPM_FETCH_TIMEOUT=180000 \
    npm_config_strict_ssl=true

# Optional: pass proxies at build time (uncomment if needed)
# ARG HTTP_PROXY
# ARG HTTPS_PROXY
# ENV HTTP_PROXY=$HTTP_PROXY
# ENV HTTPS_PROXY=$HTTPS_PROXY

# ---------- packages (network stage) ----------
FROM base AS packages
WORKDIR /app/web

# Use a mainland mirror for registry & tarballs
# (You can move this to a project .npmrc if you prefer)
RUN printf "registry=https://registry.npmmirror.com/\n@*/*:registry=https://registry.npmmirror.com/\n" > /root/.npmrc

# Only files that affect dependency graph
COPY package.json pnpm-lock.yaml ./

# Use packageManager from package.json via corepack (pins pnpm)
RUN corepack install

# Prefetch deps into pnpm store with BuildKit cache
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm fetch

# ---------- builder (no network install) ----------
FROM base AS builder
WORKDIR /app/web

# Mirror config + lock files from packages stage
COPY --from=packages /root/.npmrc /root/.npmrc
COPY --from=packages /app/web/ ./

# Bring in the full source now
# (Context must be repo root when building; see build cmd below)
COPY . .

# Offline, deterministic install from fetched store
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline

# Extra memory for Next build if needed
ENV NODE_OPTIONS="--dns-result-order=ipv4first --max-old-space-size=4096"
RUN pnpm build:docker

# ---------- production ----------
FROM base AS production

ENV NODE_ENV=production
ENV EDITION=SELF_HOSTED
ENV DEPLOY_ENV=PRODUCTION
ENV CONSOLE_API_URL=http://127.0.0.1:5001
ENV APP_API_URL=http://127.0.0.1:5001
ENV MARKETPLACE_API_URL=https://marketplace.dify.ai
ENV MARKETPLACE_URL=https://marketplace.dify.ai
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV PM2_INSTANCES=2

# set timezone (adjust if you want)
ENV TZ=UTC
RUN ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime && echo ${TZ} > /etc/timezone

WORKDIR /app/web

# Copy runtime outputs
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

# Entry script (path is relative to build context: repo root)
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Global runtime tooling
RUN pnpm add -g pm2 \
 && mkdir /.pm2 \
 && chown -R 1001:0 /.pm2 /app/web \
 && chmod -R g=u /.pm2 /app/web

ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}

USER 1001
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]