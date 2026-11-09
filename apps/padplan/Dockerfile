FROM oven/bun:1.4.2 AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts --filter padplan
RUN cd apps/padplan && bun run build:client

FROM oven/bun:1.4.2 AS production-dependencies
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts --production --filter padplan --linker hoisted

FROM oven/bun:1.4.2-slim
ARG REVISION=dev
WORKDIR /repo
COPY --from=production-dependencies /repo/node_modules ./node_modules
COPY apps/padplan/package.json apps/padplan/
COPY apps/padplan/src apps/padplan/src
COPY --from=build /repo/apps/padplan/dist/client apps/padplan/dist/client
WORKDIR /repo/apps/padplan
USER 1000:1000
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data REVISION=$REVISION CLIENT_DIR=/repo/apps/padplan/dist/client BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD bun -e 'const r = await fetch("http://127.0.0.1:3000/healthz"); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "src/app/server.ts"]
