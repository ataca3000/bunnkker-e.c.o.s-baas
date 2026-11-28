# Stage 1: Dependencias y compilación Next.js standalone (modo demo para Hugging Face Spaces)
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
RUN npx prisma generate

COPY . .

ENV NEXT_PUBLIC_APP_ENV=demo \
    NODE_OPTIONS="--max-old-space-size=4096" \
    INTERNAL_API_SECRET="bunkker-hf-space-demo-secret-key"

RUN npm run build:demo

# Stage 2: Runtime ligero compatible con Hugging Face Spaces (UID 1000, puerto 3000)
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl dumb-init ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_ENV=demo

RUN useradd -m -u 1000 user

COPY --from=builder --chown=user:user /app/.next/standalone ./
COPY --from=builder --chown=user:user /app/.next/static ./.next/static
COPY --from=builder --chown=user:user /app/public ./public
COPY --from=builder --chown=user:user /app/prisma ./prisma

RUN mkdir -p /app/.next/cache && chown -R user:user /app

USER user
EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
