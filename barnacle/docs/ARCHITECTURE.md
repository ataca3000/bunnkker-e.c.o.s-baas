# Barnacle - Docker Freemium Monetization Layer

## Arquitectura

### Flujo Completo

```
┌─────────────────────────────────────────────┐
│ Developer                                   │
│ $ barnacle config --price 9.99 --trial 14  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Barnacle CLI (shell)│
        │  Valida configuración│
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Backend (core)      │
        │  Crea License entry  │
        │  Setup Stripe product│
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Docker Hub          │
        │  Imagen publicada    │
        │  (normal)            │
        └──────────┬───────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│ Usuario Final                                │
│ $ docker run terraform98/camalion-erp       │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Docker Plugin(garra)│
        │  Intercepta run      │
        │  Valida licencia     │
        └──────────┬───────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
      ▼                         ▼
  ✅ Válido            ❌ Inválido/Trial
   Contenedor corre    Muestra GUI overlay
   normalmente         (días restantes, upsell)
```

## Componentes

### 1. **shell** (CLI)
- Comandos: `barnacle init`, `barnacle config`, `barnacle publish`
- Interactúa con Backend
- Genera `freemium.yml`

### 2. **core** (Backend)
- Express server
- Endpoints: `/api/licenses/validate`, `/webhooks/stripe`
- PostgreSQL para usuarios/licencias/suscripciones
- Integración con Stripe

### 3. **hook** (Middleware)
- Intercepta `docker run`
- Valida token/licencia
- Allow/Deny ejecución

### 4. **license** (Librería npm)
- Reutilizable en cualquier app
- `BarnacleValidator` class
- Validación offline-friendly

### 5. **panel** (GUI Overlay)
- Electron + React
- Ventana flotante
- Muestra: días trial, upgrade button, subscription status

### 6. **adapter** (Docker Plugin)
- Go plugin para Docker daemon
- Intercepta eventos de `docker run`
- Comunica con Backend

## Base de Datos (Prisma)

```prisma
model User {
  id String @id @default(cuid())
  email String @unique
  stripe_customer_id String?
  licenses License[]
  createdAt DateTime @default(now())
}

model License {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  image_name String
  license_key String @unique
  status String @default("active") // active, expired, suspended
  trial_days_remaining Int @default(14)
  subscription_ends_at DateTime?
  stripe_subscription_id String?
  createdAt DateTime @default(now())
}

model Subscription {
  id String @id @default(cuid())
  licenseId String @unique
  license License @relation(fields: [licenseId], references: [id])
  plan String // free, pro, enterprise
  price Float
  status String
  stripe_subscription_id String @unique
  createdAt DateTime @default(now())
}
```

## Desarrollo

```bash
# Instalar dependencias (desde raíz)
npm install

# Dev en paralelo
npm run dev

# Build all
npm run build

# Tests
npm run test
```

## Variables de Entorno

```env
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/barnacle
STRIPE_SECRET_KEY=sk_test_XXXXX
JWT_SECRET=tu_secret_key
NODE_ENV=production

# Docker Plugin
DOCKER_PLUGIN_SOCKET=/var/run/docker/plugins/barnacle.sock
BACKEND_URL=https://tu-barnacle-backend.com
```

## Timeline Implementación

- **Semana 1**: CLI + Backend + DB
- **Semana 2**: Docker Plugin + License Validator
- **Semana 3**: GUI Panel + Tests + Deploy

---

**Estado:** 🚧 En desarrollo
