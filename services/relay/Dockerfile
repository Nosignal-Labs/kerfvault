# Multi-stage Dockerfile for @kerfvault/relay
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Copy root workspace configurations and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages and service definitions needed for relay
COPY packages/sdk/package.json ./packages/sdk/
COPY services/relay/package.json ./services/relay/

# Install dependencies for sdk and relay
RUN pnpm install --frozen-lockfile --filter @kerfvault/sdk... --filter @kerfvault/relay...

# Copy source code
COPY packages/sdk ./packages/sdk
COPY services/relay ./services/relay

# Build sdk first, then relay
RUN pnpm --filter @kerfvault/sdk build && \
    pnpm --filter @kerfvault/relay build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY services/relay/package.json ./services/relay/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile --filter @kerfvault/sdk... --filter @kerfvault/relay...

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/services/relay/dist ./services/relay/dist

WORKDIR /app/services/relay

EXPOSE 4002

CMD ["node", "dist/index.js"]
