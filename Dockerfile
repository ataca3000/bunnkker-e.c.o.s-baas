FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos compilados en modo standalone
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# Restaurar node_modules si fue renombrado por el script de Electron
RUN if [ -d "node_modules_backup" ]; then mv node_modules_backup node_modules; fi

# Asegurar directorios de base de datos local
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app/prisma
COPY --chown=nextjs:nodejs prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
