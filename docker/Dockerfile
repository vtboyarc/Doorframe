FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/parsers/package.json packages/parsers/package.json
COPY packages/analyzers/package.json packages/analyzers/package.json
COPY packages/reporting/package.json packages/reporting/package.json
COPY packages/storage/package.json packages/storage/package.json

RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV DOORFRAME_DATA_DIR=/data/doorframe
ENV PORT=3000

COPY --from=builder /app ./

RUN mkdir -p /data/doorframe

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "apps/web"]
