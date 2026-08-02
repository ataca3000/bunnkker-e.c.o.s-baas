# Stage 1: Dependencies (lightweight, single-purpose)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Builder (includes build tools)
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++ openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV DISABLE_PWA="true" \
    NEXT_TELEMETRY_DISABLED="1"
RUN npm run build && npm prune --omit=dev

# Stage 3: Runtime (minimal, secure)
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED="1"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Create writable directory for Prisma SQLite databases
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app/prisma && chmod 755 /app/prisma

USER nextjs
EXPOSE 3000

# Use dumb-init to handle process signals properly
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Healthcheck validates app responsiveness
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

CMD ["node", "server.js"]
