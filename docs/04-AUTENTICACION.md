# 🔐 Autenticación Segura: PKCE + JWT + PIN

Especificación del sistema de autenticación multi-nivel en BUNKKER E.C.O.S.

## Métodos de Autenticación Soportados

```
┌─────────────────────────────────┐
│ PIN: Acceso rápido local (1234) │ ← Para usuarios de mostrador/POS
├─────────────────────────────────┤
│ Email + Password: Estándar      │ ← Para administración general
├─────────────────────────────────┤
│ OAuth PKCE: Más seguro          │ ← Para la App Electron de Escritorio
├─────────────────────────────────┤
│ JWT Tokens: Backend APIs        │ ← Para microservicios y sync
└─────────────────────────────────┘
```

## 1. PIN Login (Acceso Rápido POS)

Permite la conmutación rápida de cajeros y vendedores en punto de venta sin cerrar sesión de sistema.

```typescript
// app/api/auth/pin-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  const { pin, tenantId } = await req.json();

  try {
    const users = await prisma.user.findMany({
      where: { active: true }
    });

    const user = users.find(u => u.pinHash && bcrypt.compareSync(pin, u.pinHash));

    if (!user) {
      return NextResponse.json(
        { error: 'PIN o credencial inválida' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email
      },
      process.env.NEXTAUTH_SECRET || 'bunnkker-secret',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error procesando autenticación' },
      { status: 500 }
    );
  }
}
```

## 2. Token JWT y Middleware de Protección

Las rutas API protegidas requieren el encabezado `Authorization: Bearer <token>`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function verifyApiToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.NEXTAUTH_SECRET || 'bunnkker-secret');
  } catch {
    return null;
  }
}
```
