# 📜 MEMORIA TÉCNICA DESCRIPTIVA DE ARQUITECTURA E INGENIERÍA DE SISTEMAS

**Denominación de la Obra:** BUNKKER E.C.O.S. (Ecosistema Comercial Offline Sincronizado)  
**Titular de los Derechos:** Luis Felipe Durán Salinas (Philip Durán) / Brecha Soluciones S.A. de C.V.  
**Campo de Aplicación:** Planificación de Recursos Empresariales (ERP), Puntos de Venta (POS) masivos y Orquestación Logística Descentralizada Local-First.  
**Entorno Tecnológico:** TypeScript, Next.js 15 (App Router), React 19, Electron Core Node Environment, SQLite Embebido, Prisma ORM, Firebase / Cloud Firestore BaaS.  
**Fecha de Compilación:** Julio de 2026  
**Instancia Destinataria:** Instituto Nacional del Derecho de Autor (INDAUTOR) — México  

---

## 1. Introducción y Fundamentos Lógicos

### 1.1. Definición Conceptual del Sistema
BUNKKER E.C.O.S (Ecosistema Comercial Offline Sincronizado) es un sistema avanzado de planificación de recursos empresariales (ERP) diseñado bajo el paradigma de arquitectura Local-First. A diferencia de las soluciones SaaS convencionales centralizadas en la nube, BUNKKER E.C.O.S implementa una topología de red P2P (Peer-to-Peer) local, en la cual cada máquina física opera de forma autónoma como un nodo de cómputo soberano, garantizando la operación continua incluso sin conexión a internet.

### 1.2. Problema Operacional Resuelto
El tejido comercial minorista y logístico en América Latina padece de una asfixia operativa causada por la intermitencia de los enlaces de internet. Los sistemas ERP y POS tradicionales colapsan cuando la red falla, provocando pérdidas transaccionales críticas. BUNKKER E.C.O.S soluciona esta vulnerabilidad fundamental asegurando la resiliencia operativa total sin depender de una conexión estable a la red pública.

### 1.3. Visión: La Red Neuronal del Retail
El ecosistema distribuye la carga transaccional y analítica a nivel de hardware local (Edge Computing) en lugar de centralizarla en macro-servidores. Al enlazar múltiples sucursales, las unidades de retail se integran en una matriz inteligente que optimiza las cadenas de suministro regionales, reduce costos logísticos y empodera al comercio local frente a los gigantes del e-commerce.

---

## 2. Arquitectura Técnica e Ingeniería de Sistemas

### 2.1. Matriz Operacional Descentralizada (D.O.M.)
La columna vertebral del sistema es la Matriz Operacional Descentralizada (D.O.M.). Cada terminal (POS, dispositivo de inventario, etc.) opera en modo aislado utilizando un mecanismo de registro de escritura anticipada (Write-Ahead Logging - WAL). En caso de desconexión, el sistema sigue procesando transacciones sobre una base de datos local.

Para la reconciliación posterior, se implementa una cadena de hashes que garantiza la inmutabilidad y el orden cronológico de las operaciones. Cada bloque de transacciones se valida con la siguiente ecuación:

$$H_n = \text{SHA256}(id_n \times monto_n \times marca\_tiempo_n \times usuario\_id_n \times H_{n-1})$$

Donde cada transacción $H_n$ requiere del hash de la transacción anterior $H_{n-1}$ para ser admitida, previniendo fraudes y duplicaciones.

Para manejar conflictos de concurrencia (ej., dos nodos offline intentando vender el último artículo en stock), el sistema aplica una política de "primero en llegar, primero en ser servido" (First-Come, First-Served) durante la reconciliación. La transacción con la marca de tiempo (`timestamp`) más antigua que se sincroniza con éxito se considera la ganadora. Las transacciones posteriores que entren en conflicto son rechazadas y marcadas para revisión manual por un administrador, garantizando la consistencia del inventario.

### 2.2. Arquitectura Multi-Vault (Persistencia de Datos Híbrida)
El almacenamiento se gestiona a través de tres bóvedas coordinadas:
1. **SQLite / IndexedDB (Bóveda Local):** Base de datos embebida en el cliente para operaciones instantáneas (<70ms) sin latencia de red. Es el motor primario de la operación diaria.
2. **Prisma ORM (Capa de Abstracción):** Orquesta las transacciones para garantizar que las mutaciones complejas (ej. descuento de inventario en una venta) sean atómicas, consistentes, aisladas y duraderas (ACID).
3. **Google Cloud Firestore (Bóveda en la Nube):** Actúa como un repositorio pasivo y asíncrono. No gestiona la transaccionalidad en tiempo real, sino que recibe respaldos y metadatos de sincronización, manteniendo los costos de operación en la nube al mínimo.

### 2.3. Motor de Sincronización Local-First
El Nodo Maestro de un establecimiento levanta un servidor en un puerto aleatorio (`3000`-`3020`) en la red local (LAN). Los Nodos Esclavos escanean la subred, detectan al maestro y se conectan automáticamente sin configuración manual. La comunicación interna, como el chat de voz tipo "Walkie-Talkie", opera exclusivamente sobre esta red local, sin consumir ancho de banda de internet.

### 2.4. Motor de Clasificación con Inteligencia Artificial (AI Edge Engine)
Para automatizar la ingesta de catálogos, el sistema incorpora un orquestador de IA híbrido:
- **Procesamiento Local (Edge):** Utiliza expresiones regulares (Regex) y heurística para clasificar productos directamente en el dispositivo, extrayendo medidas, materiales y atributos sin necesidad de internet.
- **Fallback a la Nube:** Si el dispositivo tiene conexión y el usuario cuenta con una licencia PRO, el sistema puede consultar modelos de IA avanzados (como GPT-4o-mini) para una clasificación más precisa, con una degradación elegante al motor local si la red falla.

### 2.5. Mecanismo de Conmutación por Error de Alta Disponibilidad (Hot Standby)
Para maximizar el tiempo de actividad (uptime) y minimizar la interrupción del servicio ante una falla de hardware del Nodo Maestro, el sistema implementa un protocolo de conmutación por error semi-automático conocido como "Heredero al Trono" o Hot Standby:
- **Designación de Sucesores:** Una o más terminales con capacidad de cómputo suficiente son pre-configuradas como nodos "sucesores". Estas terminales operan normalmente como Nodos Esclavos, pero tienen el software completo para actuar como Maestro.
- **Monitoreo Activo (Heartbeat):** Todos los nodos de la red local envían periódicamente una señal de "latido" (heartbeat) al Nodo Maestro. Si un nodo sucesor no recibe respuesta del Maestro después de 3 intentos en 15 segundos, asume que el Maestro ha caído.
- **Alerta y Activación Manual:** Al detectar la caída, la interfaz del nodo sucesor muestra una alerta visible únicamente para roles de `admin` o `superadmin`. Esta alerta presenta un botón de acción: `[TOMAR CONTROL COMO NUEVO SERVIDOR MAESTRO]`.
- **Coronación Instantánea:** Al presionar el botón, el nodo sucesor ejecuta un script de "coronación" que se apropia del bloqueo de escritura, levanta los servicios de servidor y se anuncia en la red local en menos de 15 segundos.

### 2.6. Gestión de Sesiones de Larga Duración para Sincronización Offline
Para resolver el desafío de los tokens de autenticación de corta duración (típicamente 1 hora), el sistema implementa un mecanismo de renovación automática de sesiones mediante `refreshToken` almacenado encriptado localmente, permitiendo resincronizaciones automáticas aun después de días u horas offline.

---

## 3. Modelo de Negocio y Viabilidad de Mercado

### 3.1. Segmentación de Mercado (LATAM)
- **TAM (Total Addressable Market):** Más de 5 millones de PyMEs, ferreterías y bodegas en LATAM con sistemas obsoletos o sin resiliencia offline.
- **SAM (Serviceable Addressable Market):** Establecimientos en zonas con infraestructura de red deficiente o saturada.
- **SOM (Serviceable Obtainable Market):** Clústeres comerciales en corredores logísticos estratégicos.

### 3.2. Modelo de Ingresos
- **Suscripción Mensual (SaaS):** Licencias Estándar y PRO con acceso a timbrado fiscal masivo y motor de IA en la nube.
- **Comisiones de Red:** Micro-cobros por orquestar operaciones logísticas compartidas entre nodos de la red.
- **Data Insights Premium:** Acceso a análisis de tendencias de mercado para grandes proveedores, de forma anónima y agregada.

---

## 4. Compendio de Código Fuente Estructural

### 4.1. Interceptor de Seguridad y Ruteo Multi-Tenant (`src/middleware.ts`)
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_PERMISSIONS: Record<string, string[]> = {
    '/dashboard/guia': ['superadmin'],
    '/dashboard/inventory': ['superadmin', 'admin', 'inventory'],
    '/dashboard/sales': ['superadmin', 'admin', 'sales'],
    '/dashboard/audit': ['superadmin', 'admin', 'billing'],
    '/dashboard/users': ['superadmin', 'admin'],
    '/dashboard/patio': ['superadmin', 'carga_descarga', 'driver', 'inventory'],
    '/dashboard/delivery': ['superadmin', 'driver', 'carga_descarga'],
    '/dashboard/marketing': ['superadmin', 'marketing', 'admin'],
    '/dashboard/reports': ['superadmin'],
};

const PUBLIC_DOMAINS = new Set(['admin.com', 'localhost:3000', 'www.admin.com', 'admin-com-erp.vercel.app']);
const LOGIN_URL = '/login';
const UNAUTHORIZED_URL = '/login?error=unauthorized';
const DASHBOARD_URL = '/dashboard';

function getTenantId(req: NextRequest): string {
    const hostname = req.headers.get('host') || '';
    if (!PUBLIC_DOMAINS.has(hostname) && hostname.includes('.admin.com')) {
        return hostname.split('.')[0];
    }
    return req.nextUrl.searchParams.get('tenant') || 'default';
}

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const tenantId = getTenantId(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', tenantId);

    if (pathname.startsWith(DASHBOARD_URL)) {
        const session = request.cookies.get('msj-session')?.value;
        if (!session) {
            return NextResponse.redirect(new URL(LOGIN_URL, request.url));
        }

        const role = request.cookies.get('msj-role')?.value;
        if (!role) {
            return NextResponse.redirect(new URL(UNAUTHORIZED_URL, request.url));
        }

        if (role === 'superadmin') {
            return NextResponse.next({ request: { headers: requestHeaders } });
        }

        const requiredRoles = Object.entries(ROLE_PERMISSIONS).find(([path]) => pathname.startsWith(path))?.[1];

        if (requiredRoles) {
            if (!requiredRoles.includes(role)) {
                return NextResponse.redirect(new URL(UNAUTHORIZED_URL, request.url));
            }
        } else if (pathname === DASHBOARD_URL && role !== 'admin') {
            const primaryPath = Object.entries(ROLE_PERMISSIONS).find(([_, roles]) => roles.includes(role))?.[0];
            return NextResponse.redirect(new URL(primaryPath || UNAUTHORIZED_URL, request.url));
        }
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-tenant-id', tenantId);
    return response;
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
```

### 4.2. Bóveda Criptográfica y Reconciliación Offline (`src/app/api/sales/sync/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import crypto from 'crypto';

interface OfflineSale {
    id: string;
    amount: number;
    paymentMethod: 'Efectivo' | 'Transferencia';
    timestamp: string;
    hash: string;
    previousHash: string;
}

const AUTHORIZED_ROLES = new Set(['superadmin', 'admin', 'sales', 'patio']);

export async function POST(req: Request) {
    try {
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Falta Tenant ID' }, { status: 400 });
        }

        const body = await req.json();
        const { sales, lastHash } = body as { sales: OfflineSale[]; lastHash: string };

        if (!Array.isArray(sales)) {
            return NextResponse.json({ error: 'Payload de ventas inválido' }, { status: 400 });
        }

        let currentPreviousHash = lastHash || 'GENESIS_BLOCK';
        const validatedSales: OfflineSale[] = [];

        for (const sale of sales) {
            const computedHash = crypto
                .createHash('sha256')
                .update(`${sale.id}:${sale.amount}:${sale.timestamp}:${currentPreviousHash}`)
                .digest('hex');

            if (sale.hash !== computedHash) {
                return NextResponse.json(
                    { error: `Violación de integridad de hash en transacción ${sale.id}` },
                    { status: 400 }
                );
            }
            currentPreviousHash = sale.hash;
            validatedSales.push(sale);
        }

        return NextResponse.json({
            success: true,
            syncedCount: validatedSales.length,
            latestHash: currentPreviousHash,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
```

---

## 5. Firma de Registro de Obra e INDAUTOR

```
MEMORIA TÉCNICA REGISTRADA — INDAUTOR MÉXICO
HASH SHA-256 GENERAL: SHA256(BUNKKER-ECOS-INDAUTOR-JULIO-2026-COMPLETE)
TITULAR: LUIS FELIPE DURÁN SALINAS / BRECHA SOLUCIONES S.A. DE C.V.
```
