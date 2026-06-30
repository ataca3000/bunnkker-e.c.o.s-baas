# Next.js 16 + Firebase Admin + Multi-Tenant Starter

A minimal, production-ready boilerplate to build SaaS applications using Next.js App Router, Firebase Admin, and Subdomain-based Multi-Tenancy.

## Why this exists?
Setting up Firebase Admin in Next.js Edge environments often leads to ESM/Webpack crashes. Setting up Subdomain Multi-Tenancy usually requires complex edge functions. 

This boilerplate solves both issues instantly:
1. **Bulletproof Firebase Admin**: Uses a CommonJS `require` escape hatch to prevent Next.js 16 build crashes.
2. **Edge Middleware Multi-Tenancy**: Automatically extracts the tenant from subdomains (e.g. `clientA.yourdomain.com`) and injects an `x-tenant-id` header to isolate database requests.

## Setup

```bash
npm install firebase-admin
```

Create a `.env.local`:
```
FIREBASE_PROJECT_ID="your-project"
FIREBASE_CLIENT_EMAIL="your-service-account@..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

## How it works
1. **`middleware.ts`**: Intercepts requests, reads the subdomain, and passes the `tenantId` to your API routes.
2. **`src/lib/firebase-admin.ts`**: Initializes Firebase securely without crashing your build.

## License
MIT - Created by Brecha Soluciones S.A. de C.V.
