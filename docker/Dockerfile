FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/parsers/package.json packages/parsers/package.json
COPY packages/analyzers/package.json packages/analyzers/package.json
COPY packages/reporting/package.json packages/reporting/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/integrations/package.json packages/integrations/package.json

RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build:web

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ARG VERSION=0.1.7
ARG SOURCE_REPOSITORY=https://github.com/vtboyarc/Doorframe
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOORFRAME_DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

LABEL org.opencontainers.image.title="Doorframe" \
  org.opencontainers.image.description="Local-first requirements traceability web app" \
  org.opencontainers.image.source="${SOURCE_REPOSITORY}" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.licenses="MIT"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs doorframe \
  && mkdir -p /data \
  && chown -R doorframe:nodejs /data

COPY --from=builder --chown=doorframe:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=doorframe:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER doorframe

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
