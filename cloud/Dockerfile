# syntax=docker/dockerfile:1
# OpenPencil Cloud from upstream release source. The workflow builds this file
# against .build/source, a checkout of the release commit, and refreshes the
# project's lockfile within the ranges declared in package.json before building.
# Node stays on the upstream Node 22 LTS baseline; major runtime changes are manual.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4 AS bun

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/playwright:v1.65.0-noble AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile
RUN bun update
RUN bun --filter @open-pencil/cloud test:unit
RUN bun run build:packages
RUN bun run build:cloud
RUN bun --filter @open-pencil/cloud build:standalone

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    OPENPENCIL_CLOUD_SITE_DIR=/app/site \
    HOST=0.0.0.0 \
    PORT=8787
WORKDIR /app
COPY --from=build /src/packages/cloud/dist-standalone ./
COPY --from=build /src/dist-cloud ./site
COPY packages/cloud/LICENSE packages/cloud/NOTICE ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/ready`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.mjs"]
