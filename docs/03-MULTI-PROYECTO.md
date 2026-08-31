# 🏢 Multi-Proyecto: Crear Deployments Independientes

Cómo permitir que cada cliente obtenga su propio deployment personalizado en Vercel.

## Visión General

Con Bunnkker, puedes ofrecer despliegues independientes por cliente:

```
Cliente 1 → bunnkker-tienda1.vercel.app
Cliente 2 → bunnkker-tienda2.vercel.app
Cliente 3 → bunnkker-tienda3.vercel.app

Cada uno es un proyecto COMPLETAMENTE INDEPENDIENTE
```

## Flujo: Cliente Solicita su Tienda

```
┌────────────────────────────────┐
│ Cliente usa app de escritorio  │
│ o visita landing page          │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Hace click "Crear Mi Tienda"   │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Llena formulario:              │
│ - Nombre de tienda             │
│ - Email                        │
│ - Logo (opcional)              │
│ - Colores de marca             │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ POST /api/client/create-store  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Backend:                       │
│ 1. Generar proyecto           │
│ 2. Subir a Vercel             │
│ 3. Esperar build              │
│ 4. Obtener URL                │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ ✅ Tienda Lista                │
│ URL: bunnkker-tienda.vercel.app│
│ Cliente puede acceder          │
└────────────────────────────────┘
```

## Implementación: API Endpoint

### Endpoint `/api/client/create-store`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Vercel } from '@vercel/sdk';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN!
});

interface StoreRequest {
  name: string;
  email: string;
  logo?: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: StoreRequest = await req.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Nombre y email son requeridos' },
        { status: 400 }
      );
    }

    const clientId = crypto.randomUUID();
    const projectName = `bunnkker-${body.name.toLowerCase().replace(/\s+/g, '-')}-${clientId.slice(0, 8)}`;
    const slug = projectName;

    const deployment = await createVercelProject({
      projectName,
      slug,
      store: {
        id: clientId,
        name: body.name,
        email: body.email,
        logo: body.logo || '',
        colors: body.colors || { primary: '#000000' }
      }
    });

    const store = await prisma.store.create({
      data: {
        id: clientId,
        name: body.name,
        email: body.email,
        slug,
        vercelProjectId: deployment.projectId,
        vercelDeploymentId: deployment.deploymentId,
        url: deployment.url,
        logo: body.logo || '',
        colors: body.colors,
        status: 'active'
      }
    });

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        url: store.url,
        slug: store.slug,
        createdAt: store.createdAt
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Fallo al crear la tienda' },
      { status: 500 }
    );
  }
}
```

## Ventajas de Despliegue Multi-Proyecto en Vercel
- **Aislamiento Total**: Cada cliente posee su propia instancia, variables de entorno y base de datos aislada.
- **Escalabilidad Transparente**: Despliegue sobre infraestructura Edge de Vercel con SSL automático por subdominio.
- **Operatividad Híbrida**: Integración nativa con la app Electron local para sincronizar datos offline/online.
