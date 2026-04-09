# ---- Build stage ----
FROM oven/bun:1 AS build
WORKDIR /app

# Install pnpm (needed for workspace install) and Node (needed for Angular CLI)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm i -g pnpm@10 @angular/cli

# Copy workspace config + source
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/client/ apps/client/
COPY apps/server/ apps/server/

# Install with hoisted linking so Angular CLI resolves builders
RUN echo "node-linker=hoisted" > .npmrc && pnpm install --frozen-lockfile

# Build Angular into apps/server/public/
RUN cd apps/client && ng build --configuration production

# ---- Runtime stage ----
FROM oven/bun:1-slim
WORKDIR /app

# Copy server source + dependencies (remove workspace node_modules symlinks)
COPY --from=build /app/apps/server/ ./apps/server/
RUN rm -rf apps/server/node_modules
COPY --from=build /app/node_modules/ ./node_modules/

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "apps/server/index.ts"]
