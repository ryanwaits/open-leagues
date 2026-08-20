# Production: standalone Nitro server built in-image (`bun .output/server/index.mjs`).
# Household/dev path still available via OPENFF_DEV=1 (long-lived `bun run dev`).
FROM oven/bun:1.3.10-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# data/*.json (players-slim, stats, weekly-ppr) come with COPY .;
# data/pglite is excluded via .dockerignore — volume mounts /data.

# Standalone server output (Vercel preset stays the default outside Docker).
RUN NITRO_PRESET=node-server bunx vite build

ENV NODE_ENV=production

ENV PGLITE_DATA_DIR=/data/pglite \
    OPENFF_SELF_TICK=1 \
    PORT=8080 \
    BETTER_AUTH_URL=http://localhost:8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:8080/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

RUN chmod +x scripts/docker-entrypoint.sh

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
