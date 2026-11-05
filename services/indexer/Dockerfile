# Multi-stage Dockerfile for @kerfvault/indexer
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Copy root workspace configurations and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages and service definitions needed for indexer
COPY packages/sdk/package.json ./packages/sdk/
COPY services/indexer/package.json ./services/indexer/

# Install dependencies for sdk and indexer
RUN pnpm install --frozen-lockfile --filter @kerfvault/sdk... --filter @kerfvault/indexer...

# Copy source code
COPY packages/sdk ./packages/sdk
COPY services/indexer ./services/indexer

# Build sdk first, then indexer
RUN pnpm --filter @kerfvault/sdk build && \
    pnpm --filter @kerfvault/indexer build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY services/indexer/package.json ./services/indexer/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile --filter @kerfvault/sdk... --filter @kerfvault/indexer...

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist

WORKDIR /app/services/indexer

EXPOSE 4001

CMD ["node", "dist/index.js"]
