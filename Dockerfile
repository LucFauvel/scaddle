# ---- Build stage ----
FROM oven/bun:1 AS build
WORKDIR /app

# Install pnpm (needed for workspace install) and Node (needed for Angular CLI)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm i -g pnpm@10

# Copy workspace config + lockfile first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/client/ apps/client/
COPY apps/server/ apps/server/

# Build Angular into apps/server/public/
RUN cd apps/client && npx ng build --configuration production

# ---- Runtime stage ----
FROM oven/bun:1-slim
WORKDIR /app

# Copy server source + dependencies
COPY --from=build /app/apps/server/ ./apps/server/
COPY --from=build /app/node_modules/ ./node_modules/

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "apps/server/index.ts"]
