# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV DATABASE_URL=postgresql://ironcode:build-only@localhost:5432/ironcode?schema=public

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ironcode/api prisma:generate
RUN pnpm --filter @ironcode/api build
RUN pnpm --filter @ironcode/web build
RUN pnpm --filter @ironcode/staff build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=3000

RUN apt-get update \
  && apt-get install --no-install-recommends -y nginx gettext-base openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/ironcode/web

WORKDIR /opt/ironcode

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/web/dist ./web
COPY --from=build /workspace/apps/staff/dist ./web/staff

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /usr/local/bin/ironcode-entrypoint

RUN chmod +x /usr/local/bin/ironcode-entrypoint \
  && rm -f /etc/nginx/sites-enabled/default

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/ironcode-entrypoint"]
