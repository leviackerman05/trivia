# TriviaHub backend (M11 deployment, D052).
#
# Multi-stage build, non-root runtime, healthchecked.
# - Build: full workspace install (prisma generate runs via postinstall),
#   tsc build, then `pnpm deploy --prod` produces a self-contained /out
#   directory (deps copied, no pnpm store symlinks).
# - Runtime: Node 22 alpine, unprivileged user, /readyz healthcheck.
# - Migrations run from CI (`pnpm --filter @triviahub/server db:deploy`)
#   against the production DATABASE_URL, never from the container.

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @triviahub/server build
RUN pnpm --filter @triviahub/server deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup -S triviahub && adduser -S triviahub -G triviahub
COPY --from=build /out ./
COPY --from=build /app/server/prisma ./prisma
USER triviahub
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/readyz >/dev/null || exit 1
CMD ["node", "dist/index.js"]
