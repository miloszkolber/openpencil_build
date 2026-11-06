FROM oven/bun:1.4.4

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY vendor ./vendor

ENV NODE_ENV=production \
    PORT=8790
USER bun
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:8790/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "src/server.ts"]
