# Production: standalone Nitro server built in-image (`bun .output/server/index.mjs`).
# Household/dev path still available via OPENLEAGUES_DEV=1 (long-lived `bun run dev`).
FROM oven/bun:1.3.10-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# data/*.json (players-slim, stats, weekly-ppr) come with COPY .;
# data/pglite is excluded via .dockerignore — volume mounts /data.

# Render passes service env vars to Docker builds as build args; declare the
# one Vite must inline (og:image absolute URL) so the build can see it.
ARG VITE_PUBLIC_HOSTNAME
ENV VITE_PUBLIC_HOSTNAME=${VITE_PUBLIC_HOSTNAME}

# Standalone server output (Vercel preset stays the default outside Docker).
RUN NITRO_PRESET=node-server bunx vite build

# Nitro bundles PGLite's JS into _libs but not its wasm payloads; the loader
# resolves them relative to itself. Without these, the first DB touch 500s.
RUN cp node_modules/@electric-sql/pglite/dist/pglite.data \
       node_modules/@electric-sql/pglite/dist/pglite.wasm \
       node_modules/@electric-sql/pglite/dist/initdb.wasm \
       .output/server/_libs/

ENV NODE_ENV=production

ENV PGLITE_DATA_DIR=/data/pglite \
    OPENLEAGUES_SELF_TICK=1 \
    PORT=8080 \
    BETTER_AUTH_URL=http://localhost:8080

EXPOSE 8080

# Probe whatever port the platform injected (Render sets PORT=10000; the
# nitro server binds it). Hardcoding 8080 here restart-looped the instance.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e 'fetch(`http://127.0.0.1:${process.env.PORT||8080}/`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

RUN chmod +x scripts/docker-entrypoint.sh

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
