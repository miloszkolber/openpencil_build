# syntax=docker/dockerfile:1
# OpenPencil Cloud from upstream release source. The workflow builds this file
# against .build/source, a checkout of the release commit, and refreshes the
# project's lockfile within the ranges declared in package.json before building.
# Node stays on the upstream Node 22 LTS baseline; major runtime changes are manual.
# The runtime is distroless: no shell, package manager or extra OS tools.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4 AS bun

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/playwright:v1.65.0-noble AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile
RUN for attempt in 1 2 3; do \
      if bun update; then exit 0; fi; \
      echo "bun update failed; retrying in 15 seconds"; \
      sleep 15; \
    done; \
    exit 1
# The bundled demo icon client in older upstream releases reads only concrete
# icons. Newer compatible Lucide data moves names to aliases. Resolve aliases
# with Iconify's own utility instead of pinning or bypassing the refresh.
RUN bun -e 'const f="tools/generate/demo/src/document/icons.ts"; const p=Bun.file(f); if (await p.exists()) { const s=await p.text(); const old="const icon = lucide.icons[name]"; if (s.includes(old)) await Bun.write(f, "import { createRequire } from \"node:module\"\nconst { getIconData } = createRequire(import.meta.resolve(\"@open-pencil/core/icons\"))(\"@iconify/utils\")\n" + s.replace(old, "const icon = getIconData(lucide, name)")); }'
RUN bun --filter @open-pencil/cloud test:unit
RUN bun run build:packages
RUN bun run build:cloud
RUN bun --filter @open-pencil/cloud build:standalone
RUN find packages/cloud/dist-standalone -name '*.map' -delete

FROM gcr.io/distroless/nodejs22-debian12:nonroot
ENV NODE_ENV=production \
    OPENPENCIL_CLOUD_SITE_DIR=/app/site \
    HOST=0.0.0.0 \
    PORT=8787
USER root
WORKDIR /app
COPY --from=build /src/packages/cloud/dist-standalone ./
COPY --from=build /src/dist-cloud ./site
COPY packages/cloud/LICENSE packages/cloud/NOTICE ./
USER nonroot
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s \
  CMD ["/nodejs/bin/node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/ready`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["server.mjs"]
