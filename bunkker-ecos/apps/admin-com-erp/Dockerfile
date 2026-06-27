FROM node:20-alpine AS base

# Dependencias para SQLite y Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crear usuario no root por seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos generados por Next.js standalone
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# Directorio de bases de datos locales
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app/prisma
COPY --chown=nextjs:nodejs prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
