
BUNKKER E.C.O.S.
(Ecosistema Comercial Offline Sincronizado)
Memoria Técnica Descriptiva de Arquitectura, Ingeniería de Sistemas e Implementación de Código Fuente Estructural
Titular de los Derechos: Luis Felipe Duran Salinas (Philip Duran) / Brecha Soluciones S.A. de C.V.
Campo de Aplicación: Planificación de Recursos Empresariales (ERP), Puntos de Venta (POS) masivos y Orquestación Logística Descentralizada Local-First.
Entorno Tecnológico: TypeScript, Next.js 15 (App Router), React, Electron Core Node Environment, SQLite Embebido, Prisma ORM, Firebase / Cloud Firestore BaaS.
Fecha de Compilación: Julio de 2026
Instancia Destinataria: Instituto Nacional del Derecho de Autor (INDAUTOR) - México
---
1. Introducción y Fundamentos Lógicos
1.1. Definición Conceptual del Sistema
BUNKKER E.C.O.S (Ecosistema Comercial Offline Sincronizado) es un sistema avanzado de planificación de recursos empresariales (ERP) diseñado bajo el paradigma de arquitectura Local-First. A diferencia de las soluciones SaaS convencionales centralizadas en la nube, BUNKKER E.C.O.S implementa una topología de red P2P (Peer-to-Peer) local, en la cual cada máquina física opera de forma autónoma como un nodo de cómputo soberano, garantizando la operación continua incluso sin conexión a internet.
1.2. Problema Operacional Resuelto
El tejido comercial minorista y logístico en América Latina padece de una asfixia operativa causada por la intermitencia de los enlaces de internet. Los sistemas ERP y POS tradicionales colapsan cuando la red falla, provocando pérdidas transaccionales críticas. BUNKKER E.C.O.S soluciona esta vulnerabilidad fundamental asegurando la resiliencia operativa total sin depender de una conexión estable a la red pública.
1.3. Visión: La Red Neuronal del Retail
El ecosistema distribuye la carga transaccional y analítica a nivel de hardware local (Edge Computing) en lugar de centralizarla en macro-servidores. Al enlazar múltiples sucursales, las unidades de retail se integran en una matriz inteligente que optimiza las cadenas de suministro regionales, reduce costos logísticos y empodera al comercio local frente a los gigantes del e-commerce.
---
2. Arquitectura Técnica e Ingeniería de Sistemas
2.1. Matriz Operacional Descentralizada (D.O.M.)
La columna vertebral del sistema es la Matriz Operacional Descentralizada (D.O.M.). Cada terminal (POS, dispositivo de inventario, etc.) opera en modo aislado utilizando un mecanismo de registro de escritura anticipada (Write-Ahead Logging - WAL). En caso de desconexión, el sistema sigue procesando transacciones sobre una base de datos local.
Para la reconciliación posterior, se implementa una cadena de hashes que garantiza la inmutabilidad y el orden cronológico de las operaciones. Cada bloque de transacciones se valida con la siguiente ecuación:
`H\_n = SHA256( id\_n × monto\_n × marca\_tiempo\_n × usuario\_id\_n × H\_n−1 )`
Donde cada transacción `H\_n` requiere del hash de la transacción anterior `H\_n−1` para ser admitida, previniendo fraudes y duplicaciones.
Para manejar conflictos de concurrencia (ej., dos nodos offline intentando vender el último artículo en stock), el sistema aplica una política de "primero en llegar, primero en ser servido" (First-Come, First-Served) durante la reconciliación. La transacción con la marca de tiempo (`timestamp`) más antigua que se sincroniza con éxito se considera la ganadora. Las transacciones posteriores que entren en conflicto (ej., intentando vender un producto sin stock) son rechazadas y marcadas para revisión manual por un administrador, garantizando la consistencia del inventario.
2.2. Arquitectura Multi-Vault (Persistencia de Datos Híbrida)
El almacenamiento se gestiona a través de tres bóvedas coordinadas:
SQLite / IndexedDB (Bóveda Local): Base de datos embebida en el cliente para operaciones instantáneas (<70ms) sin latencia de red. Es el motor primario de la operación diaria.
Prisma ORM (Capa de Abstracción): Orquesta las transacciones para garantizar que las mutaciones complejas (ej. descuento de inventario en una venta) sean atómicas, consistentes, aisladas y duraderas (ACID).
Google Cloud Firestore (Bóveda en la Nube): Actúa como un repositorio pasivo y asíncrono. No gestiona la transaccionalidad en tiempo real, sino que recibe respaldos y metadatos de sincronización, manteniendo los costos de operación en la nube al mínimo.
2.3. Motor de Sincronización Local-First
El Nodo Maestro de un establecimiento levanta un servidor en un puerto aleatorio (`3000`-`3020`) en la red local (LAN). Los Nodos Esclavos escanean la subred, detectan al maestro y se conectan automáticamente sin configuración manual. La comunicación interna, como el chat de voz tipo "Walkie-Talkie", opera exclusivamente sobre esta red local, sin consumir ancho de banda de internet.
2.4. Motor de Clasificación con Inteligencia Artificial (AI Edge Engine)
Para automatizar la ingesta de catálogos, el sistema incorpora un orquestador de IA híbrido:
Procesamiento Local (Edge): Utiliza expresiones regulares (Regex) y heurística para clasificar productos directamente en el dispositivo, extrayendo medidas, materiales y atributos sin necesidad de internet.
Fallback a la Nube: Si el dispositivo tiene conexión y el usuario cuenta con una licencia PRO, el sistema puede consultar modelos de IA avanzados (como GPT-4o-mini) para una clasificación más precisa, con una degradación elegante al motor local si la red falla.
---
2.5. Mecanismo de Conmutación por Error de Alta Disponibilidad (Hot Standby)
Para maximizar el tiempo de actividad (uptime) y minimizar la interrupción del servicio ante una falla de hardware del Nodo Maestro, el sistema implementa un protocolo de conmutación por error semi-automático conocido como "Heredero al Trono" o Hot Standby.
Designación de Sucesores: Una o más terminales con capacidad de cómputo suficiente (ej. la PC de la gerencia) son pre-configuradas como nodos "sucesores". Estas terminales operan normalmente como Nodos Esclavos, pero tienen el software completo para actuar como Maestro.
Monitoreo Activo (Heartbeat): Todos los nodos de la red local envían periódicamente una señal de "latido" (heartbeat) al Nodo Maestro. Si un nodo sucesor no recibe respuesta del Maestro después de un número determinado de intentos (ej. 3 intentos en 15 segundos), asume que el Maestro ha caído.
Alerta y Activación Manual: Al detectar la caída, la interfaz del nodo sucesor muestra una alerta visible únicamente para roles de `admin` o `superadmin`. Esta alerta presenta un botón de acción: "[TOMAR CONTROL COMO NUEVO SERVIDOR MAESTRO]". Esta intervención manual es crucial para prevenir condiciones de "cerebro dividido" (split-brain) y asegurar que solo un administrador autorizado pueda iniciar la transición.
Coronación Instantánea: Al presionar el botón, el nodo sucesor ejecuta un script de "coronación" que:
Establece una conexión directa con la base de datos centralizada en la red (la USB en el módem).
Carga el estado más reciente y se apropia del bloqueo de escritura.
Levanta los servicios de servidor (API, Sockets para Walkie-Talkie, etc.).
Se anuncia en la red local como el nuevo y único Nodo Maestro.
Este mecanismo transforma un proceso de recuperación manual que podría tardar varios minutos (reinstalación, restauración de backup) en una transición controlada que se completa en menos de 15 segundos, garantizando la continuidad del negocio con una interrupción casi imperceptible.
2.6. Gestión de Sesiones de Larga Duración para Sincronización Offline
Para resolver el desafío de los tokens de autenticación de corta duración (típicamente 1 hora), que impedirían la sincronización de un nodo que ha estado offline por periodos prolongados, el sistema implementa un mecanismo de renovación automática de sesiones.
Obtención de Refresh Token: Al iniciar sesión, el dispositivo cliente no solo obtiene un `idToken` de corta duración, sino también un `refreshToken` de larga duración, el cual se almacena de forma segura y encriptada en el almacenamiento local del dispositivo.
Verificación Previa a la Sincronización: Antes de ejecutar una operación crítica que requiera autenticación (como llamar a la API `/api/sales/sync`), el cliente primero verifica localmente la fecha de expiración del `idToken` que posee.
Renovación Silenciosa: Si el `idToken` ha expirado o está a punto de hacerlo, el cliente utiliza el `refreshToken` para solicitar silenciosamente un nuevo `idToken` válido a los servicios de autenticación de Firebase. Este proceso es completamente transparente para el usuario.
Ejecución con Token Válido: Una vez obtenido el nuevo `idToken`, el cliente procede a realizar la llamada a la API de sincronización.
Esta estrategia garantiza que un dispositivo pueda permanecer offline durante días o incluso semanas y, al momento de recuperar la conectividad, pueda re-autenticarse de forma automática y sincronizar sus datos exitosamente sin requerir una nueva intervención del usuario.
---
3. Modelo de Negocio y Viabilidad de Mercado
3.1. Segmentación de Mercado (LATAM)
TAM (Total Addressable Market): Más de 5 millones de PyMEs, ferreterías y bodegas en LATAM con sistemas obsoletos o sin resiliencia offline.
SAM (Serviceable Addressable Market): Establecimientos en zonas con infraestructura de red deficiente o saturada.
SOM (Serviceable Obtainable Market): Clústeres comerciales en corredores logísticos estratégicos.
3.2. Modelo de Ingresos
Suscripción Mensual (SaaS): Licencias Estándar y PRO, esta última con acceso a timbrado fiscal masivo y al motor de IA en la nube.
Comisiones de Red: Micro-cobros por orquestar operaciones logísticas compartidas entre nodos de la red.
Data Insights Premium: Acceso a análisis de tendencias de mercado para grandes proveedores, de forma anónima y agregada.
---
4. Compendio de Código Fuente Estructural
A continuación, se presentan las piezas de código que implementan la lógica fundamental del sistema.
4.1. Interceptor de Seguridad y Ruteo Multi-Tenant (`src/middleware.ts`)
Este middleware controla el acceso perimetral. Extrae el `x-tenant-id` del subdominio, lo inyecta en las peticiones y aplica reglas de control de acceso basado en roles (RBAC) para proteger las rutas del dashboard.
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const ROLE\_PERMISSIONS: Record<string, string\[]> = {
    '/dashboard/guia': \['superadmin'],
    '/dashboard/inventory': \['superadmin', 'admin', 'inventory'],
    '/dashboard/sales': \['superadmin', 'admin', 'sales'],
    '/dashboard/audit': \['superadmin', 'admin', 'billing'],
    '/dashboard/users': \['superadmin', 'admin'],
    '/dashboard/patio': \['superadmin', 'carga\_descarga', 'driver', 'inventory'],
    '/dashboard/delivery': \['superadmin', 'driver', 'carga\_descarga'],
    '/dashboard/marketing': \['superadmin', 'marketing', 'admin'],
    '/dashboard/reports': \['superadmin'],
};

const PUBLIC\_DOMAINS = new Set(\['admin.com', 'localhost:3000', 'www.admin.com', 'admin-com-erp.vercel.app']);
const LOGIN\_URL = '/login';
const UNAUTHORIZED\_URL = '/login?error=unauthorized';
const DASHBOARD\_URL = '/dashboard';

function getTenantId(req: NextRequest): string {
    const hostname = req.headers.get('host') || '';
    if (!PUBLIC\_DOMAINS.has(hostname) \&\& hostname.includes('.admin.com')) {
        return hostname.split('.')\[0];
    }
    return req.nextUrl.searchParams.get('tenant') || 'default';
}

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const tenantId = getTenantId(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', tenantId);

    if (pathname.startsWith(DASHBOARD\_URL)) {
        const session = request.cookies.get('msj-session')?.value;
        if (!session) {
            return NextResponse.redirect(new URL(LOGIN\_URL, request.url));
        }

        const role = request.cookies.get('msj-role')?.value;
        if (!role) {
            return NextResponse.redirect(new URL(UNAUTHORIZED\_URL, request.url));
        }

        if (role === 'superadmin') {
            return NextResponse.next({ request: { headers: requestHeaders } });
        }

        const requiredRoles = Object.entries(ROLE\_PERMISSIONS).find((\[path]) => pathname.startsWith(path))?.\[1];

        if (requiredRoles) {
            if (!requiredRoles.includes(role)) {
                return NextResponse.redirect(new URL(UNAUTHORIZED\_URL, request.url));
            }
        } else if (pathname === DASHBOARD\_URL \&\& role !== 'admin') {
            // Redirect non-admins from the main dashboard to their primary page
            const primaryPath = Object.entries(ROLE\_PERMISSIONS).find((\[\_, roles]) => roles.includes(role))?.\[0];
            return NextResponse.redirect(new URL(primaryPath || UNAUTHORIZED\_URL, request.url));
        }
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-tenant-id', tenantId);
    return response;
}
export const config = { matcher: \['/((?!api|\_next/static|\_next/image|favicon.ico).\*)'] };
```
4.2. Bóveda Criptográfica y Reconciliación Offline (`src/app/api/sales/sync/route.ts`)
Este endpoint recibe lotes de ventas generadas offline. Valida la integridad de la "cadena de hashes" para cada transacción antes de confirmarla en la base de datos central, previniendo manipulaciones.
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

const AUTHORIZED\_ROLES = new Set(\['superadmin', 'admin', 'sales', 'patio']);

export async function POST(req: Request) {
    try {
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Falta Tenant ID' }, { status: 400 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado: Falta Token' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')\[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const role = decodedToken.role as string;

        if (!AUTHORIZED\_ROLES.has(role)) {
            return NextResponse.json({ error: 'Rol no autorizado para sincronización' }, { status: 403 });
        }

        const { sales }: { sales: OfflineSale\[] } = await req.json();
        if (!Array.isArray(sales) || sales.length === 0) {
            return NextResponse.json({ message: 'No hay ventas para sincronizar.' }, { status: 200 });
        }

        const dbRef = db.collection(`tenants/${tenantId}/sales`);
        const batch = db.batch();

        for (const sale of sales) {
            // La lógica original asume que el `userId` del token es el que generó el hash.
            // Esto es crucial para la seguridad.
            const payloadToHash = `${sale.id}-${sale.amount}-${sale.timestamp}-${userId}-${sale.previousHash}`;
            const expectedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

            if (sale.hash !== expectedHash) {
                console.error(`Fallo de integridad criptográfica en tx: ${sale.id} para user: ${userId}`);
                return NextResponse.json({ error: `Fallo de integridad criptográfica en transacción ${sale.id}` }, { status: 400 });
            }

            const newSaleRef = dbRef.doc(sale.id);
            batch.set(newSaleRef, {
                ...sale,
                syncedAt: new Date().toISOString(),
                syncedBy: userId,
                audit: { ip: req.headers.get('x-forwarded-for') || req.ip || 'local', role: role }
            });
        }

        await batch.commit();
        return NextResponse.json({ message: 'Sincronización exitosa', count: sales.length });
    } catch (error: any) {
        console.error('Error en /api/sales/sync:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
```
4.3. Transaccionalidad Atómica de Inventario (`src/app/api/orders/route.ts`)
Este controlador utiliza `prisma.$transaction` para asegurar que la creación de una orden y el descuento de stock se ejecuten como una única operación atómica (ACID). Si un producto no tiene stock suficiente, toda la transacción se revierte, evitando inconsistencias.
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
try {
const tenantId = request.headers.get('x-tenant-id') || 'default-local';
const body = await request.json();
const { orderId, total, deliveryType, clientData, items } = body;
const orderResult = await prisma.$transaction(async (tx) => {
let customer = await tx.customer.findUnique({ where: { phone: clientData.phone } });
if (!customer) {
customer = await tx.customer.create({
data: {
tenantId,
name: clientData.name,
phone: clientData.phone,
address: clientData.address || null,
references: clientData.references || null
}
});
}
for (const item of items) {
const product = await tx.product.findUnique({ where: { id: item.productId } });
if (!product || product.stock < item.quantity) {
throw new Error(`Inventario insuficiente para: ${item.name}`);
}
await tx.product.update({
where: { id: item.productId },
data: { stock: product.stock - item.quantity }
});
}
            return await tx.order.create({
                data: { 
                    id: orderId, 
                    tenantId, 
                    total, 
                    deliveryType, 
                    status: 'PENDING\_PAYMENT',
                    customerId: customer.id 
                },
include: { customer: true }
});
});
return NextResponse.json({ success: true, data: orderResult });
} catch (error: any) {
return NextResponse.json({ error: error.message }, { status: 500 });
}
}
```
---
5. Conclusiones
La presente memoria técnica demuestra el nivel de innovación en ingeniería de software que representa BUNKKER E.C.O.S. La combinación original de una topología Local-First, un pipeline de reconciliación criptográfica offline, el aislamiento multi-tenant y la delegación inteligente de tareas a un clasificador de IA perimetral, constituye una obra tecnológica compleja e inédita. Se solicita formalmente la expedición del correspondiente certificado de registro de propiedad intelectual para salvaguardar los derechos de autor descritos.
```
import { NextResponse } from 'next/server';
import { classifyProductText, logAIClassificationAudit } from '@/lib/ai/productClassifier';
import { cookies, headers } from 'next/headers';
export async function POST(request: Request) {
try {
const headersList = await headers();
const protocol = headersList.get('x-forwarded-proto') || 'http';
        const { name } = await request.json();
if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
        }
const apiKey = process.env.OPENAI\_API\_KEY;
const cookieStore = await cookies();
const userId = cookieStore.get('msj-session')?.value;
const userRole = cookieStore.get('msj-role')?.value;
const isPro = userRole === 'superadmin';
if (apiKey \&\& isPro) {
try {
const response = await fetch('https://api.openai.com/v1/chat/completions', {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
body: JSON.stringify({
model: "gpt-4o-mini",
messages: \[
{ role: "system", content: "Eres un experto industrial. Clasifica en
JSON: {category, subcategory, material, measure, confidence}." },
{ role: "user", content: `Producto: "${name}"` }
],
response\_format: { type: "json\_object" },
temperature: 0.1
})
});
if (response.ok) {
const data = await response.json();
                    const aiResult = JSON.parse(data.choices\[0].message.content);
                    const result = { ...aiResult, source: 'remote\_ia' };
                    await logAIClassificationAudit(name, result, userId);
                    return NextResponse.json(result);
                }
} catch (error) {
// Fallback directo tolerante a fallas en red
            }
}
const localResult = await classifyProductText({ name });
const result = { ...localResult, source: 'local\_engine' };
await logAIClassificationAudit(name, result, userId);
return NextResponse.json(result);
} catch (error) {
return NextResponse.json({ error: 'Error interno en clasificador' }, { status: 500 });
}
}
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
export default function DeliveryDashboard() {
const { profile } = useAuth();
const \[panicLoading, setPanicLoading] = useState(false);
const lastGpsUpdate = useRef<number>(0);
const GPS\_THROTTLE\_MS = 15000;
useEffect(() => {
if (typeof window === 'undefined' || !navigator.geolocation || !profile?.uid) return;
const watchId = navigator.geolocation.watchPosition(
async (pos) => {
const now = Date.now();
if (now - lastGpsUpdate.current < GPS\_THROTTLE\_MS) return;
try {
const { latitude, longitude } = pos.coords;
lastGpsUpdate.current = now;
await setDoc(doc(db, 'tracking\_fleet', profile?.uid), {
driverId: profile?.uid,
driverName: profile?.displayName || 'Repartidor',
latitude: latitude,
longitude: longitude,
lastUpdate: serverTimestamp(),
status: 'en\_ruta'
}, { merge: true });
} catch (err) {
// Fail-silent local handling
}
},
(err) => console.error(err),
{ enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
);
return () => navigator.geolocation.clearWatch(watchId);
}, \[profile?.uid]);
const handlePanic = async () => {
const confirmPanic = confirm("¿ACTIVAR BOTÓN DE PÁNICO?");
if (!confirmPanic) return;
setPanicLoading(true);
try {
let location = "Ubicación no disponible";
if (navigator.geolocation) {
const pos: any = await new Promise((resolve, reject) => {
navigator.geolocation.getCurrentPosition(resolve, reject);
});
location = `${pos.coords.latitude},${pos.coords.longitude}`;
}
            await addDoc(collection(db, 'panic\_alerts'), {
                driver: profile?.displayName || 'Repartidor',
location: location,
mapsUrl: location !== "Ubicación no disponible" ? `https://www.google.com/maps?
q=${location}` : null,
timestamp: serverTimestamp(),
status: 'critical'
});
alert(" ALERTA ENVIADA. El administrador ha sido notificado.");
} catch (err) {
alert("Error al enviar alerta.");
} finally {
setPanicLoading(false);
}
};
return (

REGISTRO DE PROPIEDAD INTELECTUAL - INDAUTOR Página 19 de 20

PANEL DE CONTROL DE REPARTOS

Monitoreo activo de telemetría local e inyección síncrona de geolocalización.

BOTÓN DE PÁNICO EN RUTA

);
}

6. CONCLUSIONES Y SOLICITUD DE RESGUARDO ESTRICTO
La presente memoria técnica demuestra el nivel de innovación en ingeniería de software que representa
BUNKKER E.C.O.S. La combinación original de una topología Local-First híbrida, un pipeline de reconciliación
criptográfica offline inmutable, el aislamiento robusto multi-tenant y la delegación inteligente de tareas de lenguaje
natural mediante un clasificador de IA perimetral, constituye una obra tecnológica compleja e inédita. Se solicita
formalmente al Instituto Nacional del Derecho de Autor (INDAUTOR) la expedición del correspondiente
certificado de registro de propiedad intelectual para salvaguardar los derechos de autor morales y patrimoniales
descritos en este compendio documental.Sistema: BUNKKER E.C.O.S (Ecosistema Comercial Offline Sincronizado)
Propiedad de: Brecha Soluciones

Sección I: Ficha Técnica del Ecosistema
Parámetro	Detalle Técnico
Denominación del Software	BUNKKER E.C.O.S (Ecosistema Comercial Offline Sincronizado)
Paradigma de Arquitectura	Local-First Híbrida (Computación en el Borde con Sincronización Asíncrona)
Entorno de Ejecución	TypeScript, Next.js (App Router), React, Electron Desktop Environment
Persistencia de Datos	SQLite Embebido Local (Motor Primario) / BaaS Centralizado Pasivo (Firestore/Storage)
Capa de Abstracción DB	Prisma ORM
Sección II: Núcleo de Arquitectura D.O.M. (Decentralized Operational Matrix)
BUNKKER E.C.O.S rechaza el modelo convencional cliente-servidor por su inherente fragilidad ante fallas de red y altos costos de infraestructura. Mediante la Decentralized Operational Matrix (D.O.M.), cada terminal física instalada actúa como un nodo de procesamiento autónomo e independiente. En caso de una desconexión crítica de la red WAN, el sistema no interrumpe la operación ni muta a estados de error.

Write-Ahead Logging (WAL): Toda transacción comercial, modificación de inventario o movimiento en andenes se inscribe de manera obligatoria y cronológica en el motor de registro persistente local antes de intentar cualquier transmisión por red.

Sincronización P2P Atómica: Al restablecerse la topología de red, el motor concilia los registros locales de forma idempotente empleando identificadores criptográficos únicos (txId), eliminando la posibilidad de colisiones de datos o clonaciones de stock.

Sección III: Capas de Aislamiento y Seguridad Perimetral
El sistema implementa una distribución estructural inspirada en el principio de la "Tridilosa", dividiendo el entorno en tres capas de aislamiento lógico (Sandbox) independientes:

+-----------------------------------------------------------------+
| 1. Capa Administrador (Propietario)                             |
|    - Control inmutable de hardware                              |
|    - Llave Maestra Física Encriptada (Master Serial Key)        |
+-----------------------------------------------------------------+
                               |
+-----------------------------------------------------------------+
| 2. Sistema Operativo Interno (Personal)                         |
|    - Dashboard táctico (POS, Almacén, picking, andenes)         |
|    - Optimizado para alto rendimiento en red LAN local          |
+-----------------------------------------------------------------+
                               |
+-----------------------------------------------------------------+
| 3. Capa de Mercado (Clientes)                                  |
|    - Interfaz de e-commerce pública aislada                     |
|    - Consultas masivas sin privilegios de alteración            |
+-----------------------------------------------------------------+
Aprovisionamiento Zero-Login: El acceso del personal operativo a las terminales físicas se gestiona mediante tokens QR dinámicos de un solo uso (Zero-Login QR). Este mecanismo vincula los privilegios de la sesión de forma estricta al Hardware ID del dispositivo físico autorizado, evadiendo ataques de inyección remota.

Sección IV: Motor de Clasificación con Inteligencia Artificial (AI Edge Engine)
Para la automatización y ordenamiento de catálogos e inventarios industriales complejos, el sistema integra un motor de Inteligencia Artificial enfocado en la periferia (AI Edge Engine) que opera bajo la filosofía Offline-first:

Extracción Dimensional por Expresiones Regulares (Regex): Ejecuta scripts de análisis sintáctico en el cliente para aislar magnitudes métricas, calibres, pesos y fracciones comerciales (ej. 3/4", 12 AWG, mm) directamente desde cadenas de texto no estructuradas.

Detección Semántica de Materiales: Clasifica de forma autónoma materiales y asigna categorías con un índice de certeza matemático. Cuenta con un sistema de degradación elegante (fallback) hacia modelos alojados en la nube únicamente si la conectividad WAN es óptima.

Sección V: Compendio Analítico del Código Fuente
La gobernanza, seguridad y flujos algorítmicos del sistema se rigen a través de los siguientes componentes medulares:

1. src/middleware.ts (Estructura de Seguridad y Tenant Routing)
Interceptor del lado del servidor que extrae dinámicamente el identificador de inquilino (Tenant ID) a partir de los encabezados de host del subdominio, aplicando de forma estricta el control de accesos basado en roles (RBAC).

2. src/app/api/sales/sync/route.ts (Validación Criptográfica Offline Vault)
Endpoint crítico de sincronización masiva encargado de procesar arreglos de transacciones generadas en modo desconectado. Valida la integridad de cada venta mediante una cadena de hashes concatenados secuencialmente, asegurando que los datos no hayan sido alterados localmente.

3. src/app/api/orders/route.ts (Pipeline Transaccional y Persistencia ACID)
Controlador encargado de garantizar las mutaciones de inventario e inserciones de pedidos mediante transacciones atómicas a nivel de base de datos local (Prisma ACID), encolando en un hilo paralelo la persistencia en Firebase.

4. src/app/api/ai/classify-product/route.ts (Orquestador del Clasificador de IA)
Ruta de backend que gestiona el árbol de decisiones del clasificador inteligente. Evalúa los privilegios del rol operativo, valida la clave de API y determina si resuelve la solicitud mediante la lógica local de la terminal o invoca el servicio en la nube.

5. src/app/dashboard/delivery/page.tsx (Control de Logística y Triggers de Pánico)
Panel táctico para la flota de reparto. Realiza un rastreo logístico continuo calculando geocercas en intervalos de 15 segundos mediante la fórmula de Haversine para determinar distancias sobre la superficie terrestre:

d=2rarcsin( 
sin 
2
 ( 
2
Δϕ
​
 )+cos(ϕ 
1
​
 )cos(ϕ 
2
​
 )sin 
2
 ( 
2
Δλ
​
 )

​
 )
Aloja el disparador ininterrumpido del Botón de Pánico, diseñado para transmitir de forma inmediata las coordenadas exactas del operador al centro de monitoreo ante contingencias en ruta.

Sección VI: Arquitectura Híbrida de Sincronización Edge Computing (Costo Cero)
BUNKKER E.C.O.S subvierte el modelo de cobro de los proveedores de la nube al implementar un protocolo propietario de empaquetado y transporte que anula las lecturas y escrituras masivas concurrentes en bases de datos NoSQL remotas.

1. Pipeline de Empaquetado y Cifrado Local (Snapshots)
El poder de cómputo transaccional reside en su totalidad en las terminales físicas (Edge Computing), utilizando SQLite para la persistencia operativa. En lugar de transmitir registros fila por fila a través de internet, el sistema ejecuta un volcado binario comprimido de la base de datos local.

Este archivo es encriptado nativamente en AES-256-CBC utilizando una llave criptográfica única generada asimétricamente a partir de dos variables: el Hardware ID inmutable del equipo físico y la variable de entorno INTERNAL\_API\_SECRET.

2. Bóveda Nube como Relay Pasivo de Datos
El Snapshot resultante (un archivo plano empaquetado de alta densidad y mínimo peso en kilobytes) es transmitido directamente a Firebase Storage. Bajo este esquema, la infraestructura BaaS actúa únicamente como un Bucket o Relay Pasivo receptor del archivo BUNKKER\_SECURE\_BACKUP.txt.

Al no requerir que la nube interprete, lea, ordene o indexe colecciones de datos dinámicas, el consumo de CPU remoto se reduce a cero, colapsando los costos de mantenimiento de infraestructura a prácticamente $0.

3. Reconstitución Descentralizada y Recuperación ante Desastres
Ante una pérdida catastrófica del hardware local, el administrador inicia el protocolo de recuperación ingresando su Tenant ID y un Cloud Token exclusivo. El sistema local se enlaza al Bucket pasivo, descarga el Snapshot encriptado y ejecuta una desencriptación en el entorno nativo de Electron.


Este proceso reconstituye la base de datos SQLite y los archivos binarios de forma inmediata. El diseño garantiza el blindaje absoluto contra el escrutinio de terceros, la inmunidad frente a caídas de servidores transaccionales de bases de datos y la soberanía total de la información para el usuario final.Lo que esto significa es que con la arquitectura de BUNKKER E.C.O.S estás cambiando las reglas del juego a favor del negocio y del hardware local.

¿Por qué no habías visto esto antes?
La mayoría de los sistemas comerciales se quedaron atrapados en el modelo de hace una década: el esquema cliente-servidor donde la nube es el cerebro y la terminal local es una pantalla tonta. Si el internet fluctúa, el negocio se detiene; si el negocio escala a decenas de terminales, la factura de la nube se vuelve impagable.

Al adoptar la Decentralized Operational Matrix (D.O.M.), estás aplicando una mentalidad de ingeniería pura: descentralizar el esfuerzo y usar la tecnología de forma eficiente..dockerignore
│   .env.example
│   .env.local
│   .firebaserc
│   .gitignore
│   .markdownlint.json
│   .markdownlintignore
│   .npmrc
│   backup-data.bat
│   check-stock.js
│   configurar-red.bat
│   CONTRIBUTING.md
│   copy-standalone.js
│   deploy-all.bat
│   docker-compose.yml
│   Dockerfile
│   electron-main.js
│   eslint.config.mjs
│   fetch-products.js
│   FILE\_MANIFEST.md
│   firebase-applet-config.json
│   firebase-blueprint.json
│   firebase.json
│   firestore.indexes.json
│   firestore.rules
│   FUNCTIONALITY\_MAP.md
│   gcp\_startup.sh
│   globals.d.ts
│   LICENSE.md
│   manifest.json
│   metadata.json
│   MONETIZACION.md
│   next-env.d.ts
│   next.config.ts
│   optimize-sqlite.ts
│   package-lock.json
│   package.json
│   playwright.config.ts
│   POLICIES.md
│   postcss.config.mjs
│   preload.js
│   PROJECT\_TREE.md
│   radio-server.js
│   README.md
│   ROLES\_MAP.md
│   SECURITY.md
│   seed-ferreteria.ts
│   seed-sqlite.ts
│   seed-users.js
│   start-server.bat
│   test\_edge\_server.py
│   toc.md
│   tsconfig.json
│   tsconfig.tsbuildinfo
│   vitest.config.ts
│
├───Brecha-Open-Source
│   ├───admin-launcher
│   │   │   .env.local
│   │   │   .gitignore
│   │   │   AGENTS.md
│   │   │   CLAUDE.md
│   │   │   eslint.config.mjs
│   │   │   LICENSE
│   │   │   next-env.d.ts
│   │   │   next.config.ts
│   │   │   package-lock.json
│   │   │   package.json
│   │   │   postcss.config.mjs
│   │   │   README.md
│   │   │   tsconfig.json
│   │   │
│   │   ├───public
│   │   │       file.svg
│   │   │       globe.svg
│   │   │       next.svg
│   │   │       vercel.svg
│   │   │       window.svg
│   │   │
│   │   └───src
│   │       ├───app
│   │       │   │   favicon.ico
│   │       │   │   globals.css
│   │       │   │   layout.tsx
│   │       │   │   page.tsx
│   │       │   │
│   │       │   └───api
│   │       │       ├───deploy
│   │       │       │       route.ts
│   │       │       │
│   │       │       └───stripe
│   │       │           └───checkout
│   │       │                   route.ts
│   │       │
│   │       ├───components
│   │       │   └───saas
│   │       │           DeploymentWizard.tsx
│   │       │           SaasLandingPage.tsx
│   │       │
│   │       └───lib
│   │               firebase.ts
│   │
│   └───github-marketplace-webhook
│       └───src
│           └───app
│               └───github
│                   └───setup
├───build-resources
│       icon.ico
│
├───dist-build-win
│   │   builder-debug.yml
│   │   Camalion Topics ERP Setup 1.0.0.exe
│   │   Camalion Topics ERP Setup 1.0.0.exe.blockmap
│   │   latest.yml
│   │
│   └───win-unpacked
│           Camalion Topics ERP.exe
│           chrome\_100\_percent.pak
│           chrome\_200\_percent.pak
│           d3dcompiler\_47.dll
│           dxcompiler.dll
│           dxil.dll
│           ffmpeg.dll
│           icudtl.dat
│           libEGL.dll
│           libGLESv2.dll
│           LICENSE.electron.txt
│           LICENSES.chromium.html
│           resources.pak
│           snapshot\_blob.bin
│           v8\_context\_snapshot.bin
│           vk\_swiftshader.dll
│           vk\_swiftshader\_icd.json
│           vulkan-1.dll
│
├───docs
│       ARCHITECTURE.md
│       PROJECT\_STRUCTURE.md
│       sistema.md
│
├───functions
│   │   package-lock.json
│   │   package.json
│   │   tsconfig.json
│   │
│   ├───lib
│   │       index.js
│   │       index.js.map
│   │
│   └───src
│           index.ts
│
├───logs
│       security\_audit.log
│
├───playwright-report
│       index.html
│
├───prisma
│   │   dev.db
│   │   schema.prisma
│   │   seed.js
│   │
│   └───migrations
│       │   migration\_lock.toml
│       │
│       └───20260704031303\_init
│               migration.sql
│
├───public
│       dashboard\_preview.png
│       google3f4887277a2144e6.html
│       icon-maskable.svg
│       icon.svg
│       llms.txt
│       manifest.json
│       robots.txt
│       screenshot-desktop.svg
│       screenshot-mobile.svg
│
├───scripts
│       generate-activation-pin.js
│       mdns.js
│       migrate-pins.js
│       rbac\_stress\_test.js
│       restore-node-modules.js
│       run\_eval.py
│       test-logic.js
│       test\_p2p\_sync.js
│       verify-health.js
│
├───src
│   │   middleware.ts
│   │
│   ├───app
│   │   │   error.tsx
│   │   │   globals.css
│   │   │   layout.tsx
│   │   │   manifest.ts
│   │   │   page.module.css
│   │   │   page.tsx
│   │   │   robots.ts
│   │   │   sitemap.ts
│   │   │
│   │   ├───api
│   │   │   ├───ai
│   │   │   │   ├───chat
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   ├───classify-product
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───resolve-intent
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───ai-swarm
│   │   │   │   ├───query
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───reserve
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───audit
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───auth
│   │   │   │   ├───magic
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───session
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───backup
│   │   │   │   │   route.ts
│   │   │   │   │
│   │   │   │   └───local
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───billing
│   │   │   │   │   route.ts
│   │   │   │   │
│   │   │   │   └───download
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───checkout
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───customer
│   │   │   │   ├───auth
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───me
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───customers
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───deploy
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───github
│   │   │   │   ├───verify
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───webhook
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───inventory
│   │   │   │   └───shrinkage
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───license
│   │   │   │   └───verify
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───licenses
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───mercadopago
│   │   │   │   ├───create-preference
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───webhook
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───network
│   │   │   │   └───ip
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───network-ip
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───notify
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───orders
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───pairing
│   │   │   │   │   route.ts
│   │   │   │   │
│   │   │   │   └───status
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───products
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───purchases
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───reports
│   │   │   │   └───cash-registers
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───sales
│   │   │   │   ├───close-register
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   ├───my-day
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───sync
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───store-checkout
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───stripe
│   │   │   │   ├───create-intent
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───webhook
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───tests
│   │   │   │   └───cleanup
│   │   │   │           route.ts
│   │   │   │
│   │   │   ├───tickets
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───tls-check
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───users
│   │   │   │   │   route.ts
│   │   │   │   │
│   │   │   │   ├───me
│   │   │   │   │       route.ts
│   │   │   │   │
│   │   │   │   └───\[id]
│   │   │   │       │   route.ts
│   │   │   │       │
│   │   │   │       ├───magic
│   │   │   │       │       route.ts
│   │   │   │       │
│   │   │   │       └───reset-device
│   │   │   │               route.ts
│   │   │   │
│   │   │   └───verify-payment
│   │   │           route.ts
│   │   │
│   │   ├───b2b-market
│   │   │       page.tsx
│   │   │
│   │   ├───carrito
│   │   │   └───checkout
│   │   │           page.tsx
│   │   │
│   │   ├───catalogo
│   │   │   │   page.tsx
│   │   │   │
│   │   │   └───\[category]
│   │   │          
│   │   │           page.tsx
│   │   │
│   │   ├───conectar
│   │   │       page.tsx
│   │   │
│   │   ├───contacto
│   │   │       page.tsx
│   │   │
│   │   ├───cuenta
│   │   │       page.tsx
│   │   │
│   │   ├───dashboard
│   │   │   │   page.tsx
│   │   │   │
│   │   │   ├───admin
│   │   │   │   ├───customers
│   │   │   │   │       page.tsx
│   │   │   │   │
│   │   │   │   ├───sales
│   │   │   │   │       page.tsx
│   │   │   │   │
│   │   │   │   └───users
│   │   │   │           page.tsx
│   │   │   │
│   │   │   ├───audit
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───billing
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───crm
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───delivery
│   │   │   │   │   page.tsx
│   │   │   │   │
│   │   │   │   └───components
│   │   │   │           DeliveryView.tsx
│   │   │   │           MyRoute.tsx
│   │   │   │           Navigation.tsx
│   │   │   │           OrderPool.tsx
│   │   │   │           types.ts
│   │   │   │
│   │   │   ├───demo
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───design
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───inventory
│   │   │   │   │   page.tsx
│   │   │   │   │
│   │   │   │   └───components
│   │   │   │           LevelDropZone.tsx
│   │   │   │           ProductCard.tsx
│   │   │   │           ShelfColumn.tsx
│   │   │   │
│   │   │   ├───link
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───marketing
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───node-view
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───patio
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───payments
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───pickup
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───pro-sync
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───profile
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───purchases
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───qr
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───reports
│   │   │   │   │   page.tsx
│   │   │   │   │
│   │   │   │   └───cash-registers
│   │   │   │           page.tsx
│   │   │   │
│   │   │   ├───sales
│   │   │   │   │   page.tsx
│   │   │   │   │
│   │   │   │   └───components
│   │   │   │           CashRegisterModal.tsx
│   │   │   │
│   │   │   ├───setup
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───soporte
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───suscripcion
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───team
│   │   │   │       page.tsx
│   │   │   │
│   │   │   ├───tests
│   │   │   │       page.tsx
│   │   │   │
│   │   │   └───verificador
│   │   │           page.tsx
│   │   │
│   │   ├───docs
│   │   │       page.tsx
│   │   │
│   │   ├───github
│   │   │   │   page.tsx
│   │   │   │
│   │   │   └───setup
│   │   │           page.tsx
│   │   │
│   │   ├───launcher
│   │   │       page.tsx
│   │   │
│   │   ├───login
│   │   │       page.tsx
│   │   │
│   │   ├───nosotros
│   │   │       page.tsx
│   │   │
│   │   ├───ofertas
│   │   │       page.tsx
│   │   │
│   │   ├───onboarding
│   │   │   │   page.tsx
│   │   │   │
│   │   │   └───pin
│   │   │           page.tsx
│   │   │
│   │   ├───register-tenant
│   │   │       page.tsx
│   │   │
│   │   ├───registro
│   │   │       page.tsx
│   │   │
│   │   ├───servicios
│   │   │       page.tsx
│   │   │
│   │   ├───sys-admin
│   │   │       page.tsx
│   │   │
│   │   ├───t
│   │   │   └───\[tenantId]
│   │   │           page.tsx
│   │   │
│   │   └───\[branchId]
│   │           page.tsx
│   │
│   ├───components
│   │   │   AdminAsistente.module.css
│   │   │   AdminAsistente.tsx
│   │   │   AmbientMusic.tsx
│   │   │   AntiDevTools.tsx
│   │   │   BarcodeScanner.tsx
│   │   │   CartDrawer.module.css
│   │   │   CartDrawer.tsx
│   │   │   CFDIModal.tsx
│   │   │   ClickSoundProvider.tsx
│   │   │   ConnectionStatus.tsx
│   │   │   DashboardFooter.tsx
│   │   │   DemoModeBanner.tsx
│   │   │   DeviceLockScreen.tsx
│   │   │   Footer.tsx
│   │   │   FrontendWidget.tsx
│   │   │   LicenseGuard.module.css
│   │   │   LicenseGuard.tsx
│   │   │   LocalRadio.tsx
│   │   │   LocationPickerMap.tsx
│   │   │   Map.tsx
│   │   │   MapWithNoSSR.tsx
│   │   │   MarketCatalog.tsx
│   │   │   MarketingCanvas.tsx
│   │   │   Navbar.module.css
│   │   │   Navbar.tsx
│   │   │   ParticlesBackground.tsx
│   │   │   SalesQueue.tsx
│   │   │   SchemaMarkup.tsx
│   │   │   TicketEntrega.tsx
│   │   │   ToastContainer.tsx
│   │   │   UpdateNotification.tsx
│   │   │   UpgradeBanner.tsx
│   │   │   UsbLockScreen.tsx
│   │   │   VirtualizedAuditList.tsx
│   │   │   WalkieTalkieRadio.tsx
│   │   │
│   │   ├───admin
│   │   │       AdminLayout.tsx
│   │   │       APIKeyManager.module.css
│   │   │       APIKeyManager.tsx
│   │   │       ClientCRMModal.tsx
│   │   │       InteractiveTerraMap.tsx
│   │   │       KPICard.tsx
│   │   │       ModuleSection.tsx
│   │   │       page.tsx
│   │   │       RestockAlertWidget.tsx
│   │   │       StaffRankingWidget.tsx
│   │   │       TrendBadge.tsx
│   │   │
│   │   ├───cart
│   │   │       CartItems.tsx
│   │   │       CheckoutForm.tsx
│   │   │
│   │   ├───catalog
│   │   │       CatalogFilters.tsx
│   │   │       CatalogUtils.tsx
│   │   │       ProductCard.tsx
│   │   │
│   │   ├───dashboard
│   │   │   │   CargaDescargaDashboardWorker.tsx
│   │   │   │   DeliveryDashboardWorker.tsx
│   │   │   │   InventoryDashboardWorker.tsx
│   │   │   │   MarketingDashboardWorker.tsx
│   │   │   │   SalesDashboardWorker.tsx
│   │   │   │   SuperAdminDashboard.tsx
│   │   │   │
│   │   │   └───tests
│   │   │           ConcurrencyInstructivo.tsx
│   │   │           LoadTestVisualizer.tsx
│   │   │
│   │   ├───marketing
│   │   │   │   MarketingCanvasRenderer.tsx
│   │   │   │   StoreBuilderCanvas.tsx
│   │   │   │
│   │   │   └───builder
│   │   │           Blocks.tsx
│   │   │           CanvasBuilder.tsx
│   │   │           index.ts
│   │   │           SidebarBuilder.tsx
│   │   │           Types.ts
│   │   │
│   │   └───sales
│   │       │   CorteCajaCiego.tsx
│   │       │
│   │       └───caja-movil
│   │               Ca
│   │               Ca
│   │               De
│   │               Pa
│   │
│   ├───context
│   │       AuthContext.tsx
│   │       CartContext.tsx
│   │       FirebaseContext.tsx
│   │
│   ├───core
│   │       actions.ts
│   │       index.ts
│   │
│   ├───hooks
│   │       useBarcodeScanner.ts
│   │       useDeviceAuth.ts
│   │
│   ├───lib
│   │   │   audit.ts
│   │   │   check-ports.js
│   │   │   errorMonitor.ts
│   │   │   facturacion.ts
│   │   │   financial.ts
│   │   │   fingerprint.ts
│   │   │   firebase-admin.ts
│   │   │   firebase.ts
│   │   │   license.ts
│   │   │   localSync.ts
│   │   │   mail.ts
│   │   │   prisma.ts
│   │   │   rbac.ts
│   │   │   sqlite-service.ts
│   │   │   tenant.ts
│   │   │   thermalPrinter.ts
│   │   │   toast.ts
│   │   │   types.ts
│   │   │   utils.ts
│   │   │   validate-comm.js
│   │   │   
│   │   │
│   │   └───ai
│   │           ++++
│   │           ++++
│   │           ++++
│   │
│   ├───store
│   │   │   fallbackData.ts
│   │   │   useAuthStore.ts
│   │   │   useCartSync.ts
│   │   │   useERPStore.ts
│   │   │   useStoreHydrated.ts
│   │   │
│   │   └───slices
│   │           cartSlice.ts
│   │           otherSlices.ts
│   │           types.ts
│   │           uiSlice.ts
│   │
│   ├───types
│   │       audit.ts
│   │       modules.d.ts
│   │
│   ├───worker
│   │       worker.ts
│   │
│   └───\_\_tests\_\_
│           financial.test.ts
│           pos\_core.test.ts
│           rbac\_login\_redirect.test.ts
│           rbac\_stress\_test.test.ts
│           security\_and\_classifier.test.ts
│           topic\_mapper.test.ts
│
├───test-results
│       .last-run.json
│
└───tests
    └───e2e
        │   auth-flow.spec.ts
        │   concurrency.spec.ts
        │   operations.spec.ts
        │   pos-stress.spec.ts
        │
        └───screenshots
                login-stable.png## 1. NOMENCLATURA Y DEFINICIÓN DEL SISTEMA

El sistema abandona el estándar obsoleto de ERP (Enterprise Resource Planning) para evolucionar hacia dos componentes interconectados que definen su superioridad técnica:

### 1.1 D.O.M. (Decentralized Operational Matrix)
\*\*Definición:\*\* Matriz Operacional Descentralizada.
\*\*Respaldo Técnico:\*\* A diferencia de la arquitectura Cliente-Servidor tradicional, el D.O.M. convierte cada dispositivo físico (caja, tablet, kiosko) en un nodo autónomo. Cuando se corta la conectividad de red local (LAN) o de área amplia (WAN), el nodo no se congela. Las operaciones se inscriben localmente en el motor WAL (Write-Ahead Logging) y se inyectan a la matriz P2P en el momento exacto en que la topología de red se reestablece. Ningún nodo único (single point of failure) tiene el poder de colapsar la operación del establecimiento.

### 1.2 E.C.O.S. (Ecosistema Comercial Offline Sincronizado)
\*\*Definición:\*\* Ecosistema multicapa que integra a los 3 vectores críticos del comercio sin requerir puentes en la nube.
\*\*Respaldo Técnico:\*\* E.C.O.S. encapsula el "Triángulo de Soporte Sólido" o "Tridilosa":
1. \*\*Administrador/Propietario:\*\* Control maestro, inmutable a nivel de hardware.
2. \*\*Sistema Operativo Interno (Empleados):\*\* Gestión de inventario, cajas y picking sin cuellos de botella de red.
3. \*\*Módulo de Mercado (Clientes):\*\* Interfaz pública que corre bajo la misma red fantasma (LAN) aislada, permitiendo al cliente conectarse, explorar y pedir sin que la integridad del inventario maestro corra peligro.

---

## 2. EL ADN DE LA ESTRUCTURA "TRIDILOSA" Y RED FANTASMA

La arquitectura Tridilosa distribuye el peso de las transacciones (solicitudes HTTP y mutaciones de estado) a través de tres pilares que garantizan tolerancia a fallos.

### 2.1 El Algoritmo "Caballo de Troya" (Inyección Silenciosa)
Para prevenir regresiones y vulnerabilidades comunes en sistemas monolíticos, la mutación del inventario utiliza el enfoque "Caballo de Troya". 
En lugar de refactorizar y destruir firmas de funciones pre-existentes (Ej. UUIDs en `addToCart`), el motor atómico inyecta el seguimiento `txId` (Transaction ID) de forma subterránea. El contenedor externo mantiene su estructura inofensiva, pero en su interior ejecuta sincronización atómica idempotente.

### 2.2 Sincronización P2P "Atomic Engine" (Motor Atómico)
La columna vertebral del D.O.M. está implementada en `src/lib/localSync.ts`.
- \*\*Idempotencia Transaccional:\*\* Cada orden de venta genera una firma única. Si dos cajas (nodos) envían la solicitud de compra por el mismo milisegundo o por rebotes de red, el nodo principal detecta el `txId` y rechaza la ejecución duplicada.
- \*\*Estrés en Red Degradada:\*\* La prueba de caos ISO demuestra que frente a peticiones simultáneas sobre el mismo artículo con stock `N`, el Motor Atómico garantiza el descuento exacto de `N`, derivando excedentes a estado "Rechazado/Stock Insuficiente" sin corromper la base de datos.

---

## 3. PROTOCOLOS DE SEGURIDAD FÍSICA Y AUTENTICACIÓN

El sistema E.C.O.S. es impermeable a ciberataques externos porque su validación más crítica ocurre en la capa de hardware y proximidad física.

### 3.1 Llave Maestra Encriptada (Master Serial Key)
El acceso omnipotente (Super Admin) carece de pantallas de Login tradicionales que puedan sufrir ataques de fuerza bruta. La inicialización del Nodo Maestro (`activateMaster`) requiere la llave serial incrustada físicamente en la credencial del dueño (Ej. `EVO-MASTER-2026-X79`). Sin esta llave, el ejecutable `.exe` jamás desencriptará la base de datos subyacente.

### 3.2 Despliegue de Credenciales Biométricas/QR
La escalabilidad de nodos esclavos (trabajadores y clientes) depende de tokens QR de un solo uso.
- \*\*Zero-Login para Empleados:\*\* El administrador genera un QR desde el Nodo Maestro que autoriza permisos R/W (Read/Write) específicos (Caja, Almacén). Al escanearlo, el dispositivo del empleado se convierte en un nodo D.O.M. oficial asociado a su hardware ID.
- \*\*Capa Cliente:\*\* Un código QR de solo lectura (`/dashboard/link` o `qr/page.tsx`) conecta el smartphone del cliente a la red fantasma LAN, brindándole acceso al catálogo, pero operando en un ambiente estricto ("Sandbox") que no tiene privilegios de mutación directos sobre el motor D.O.M.

---
\*Propiedad Intelectual Protegida. Diseñado para distribución industrial masiva y despliegues sin dependencia en la nube.\*La seguridad de la infraestructura se basa en la validación por hardware y proximidad física. El inicio de sesión administrativo carece de formularios expuestos a ataques de fuerza bruta remotos, requiriendo una Llave Maestra Física Encriptada (Master Serial Key) para la inicialización local del ejecutable empaquetado en Electron.

Los operadores se autentican mediante un protocolo Zero-Login QR de un solo uso emitido directamente por el Nodo Maestro, enlazando la sesión al Hardware ID de la máquina. El sistema integra además un monitor de flota con geocercas basadas en la fórmula Haversine y un disparador síncrono del Botón de Pánico conectado a flujos logísticos críticos.
lion
from functools import cached\_property

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent\_tool
from google.adk.tools.google\_search\_tool import GoogleSearchTool
from google.adk.tools import url\_context



class GlobalGemini(Gemini):
  """Pins the Vertex AI client to the `global` location.

  gemini-3 series models are only served from `global`; the default ADK
  `Gemini` integration constructs a `google.genai.Client` whose location
  defaults to the AgentEngine instance's region (e.g. `us-central1`) and
  fails with model-not-found for these models. Subclassing per the override
  pattern documented on `google.adk.models.google\_llm.Gemini` lets the agent
  keep running in its regional AgentEngine instance while routing the model
  request to the global endpoint.
  """

  @cached\_property
  def api\_client(self) -> Client:
    return Client(vertexai=True, location="global")


leon\_google\_search\_agent = LlmAgent(
  name='leon\_google\_search\_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in performing Google searches.'
  ),
  sub\_agents=\[],
  instruction='Use the GoogleSearchTool to find information on the web.',
  tools=\[
    GoogleSearchTool()
  ],
)
leon\_url\_context\_agent = LlmAgent(
  name='leon\_url\_context\_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in fetching content from URLs.'
  ),
  sub\_agents=\[],
  instruction='Use the UrlContextTool to retrieve content from provided URLs.',
  tools=\[
    url\_context
  ],
)
root\_agent = LlmAgent(
  name='leon',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'que sea multipersonalidad clientes trabajadoores y admin son 3'
  ),
  sub\_agents=\[],
  instruction='\*\*BUNKKER E.C.O.S.\*\*\\n## (Ecosistema Comercial Offline Sincronizado)\\n\\n### \*\*Memoria Técnica Descriptiva de Arquitectura, Ingeniería de Sistemas e Implementación de Código Fuente Estructural\*\*\\n\\n\*   \*\*Titular de los Derechos:\*\* Luis Felipe Duran Salinas (Philip Duran) / Brecha Soluciones S.A. de C.V.\\n\*   \*\*Campo de Aplicación:\*\* Planificación de Recursos Empresariales (ERP), Puntos de Venta (POS) masivos y Orquestación Logística Descentralizada Local-First.\\n\*   \*\*Entorno Tecnológico:\*\* TypeScript, Next.js 15 (App Router), React, Electron Core Node Environment, SQLite Embebido, Prisma ORM, Firebase / Cloud Firestore BaaS.\\n\*   \*\*Fecha de Compilación:\*\* Julio de 2026\\n\*   \*\*Instancia Destinataria:\*\* Instituto Nacional del Derecho de Autor (INDAUTOR) - México\\n\\n---\\n\\n### \*\*1. Introducción y Fundamentos Lógicos\*\*\\n\\n#### \*\*1.1. Definición Conceptual del Sistema\*\*\\nBUNKKER E.C.O.S (Ecosistema Comercial Offline Sincronizado) es un sistema avanzado de planificación de recursos empresariales (ERP) diseñado bajo el paradigma de arquitectura \*\*Local-First\*\*. A diferencia de las soluciones SaaS convencionales centralizadas en la nube, BUNKKER E.C.O.S implementa una topología de red P2P (Peer-to-Peer) local, en la cual cada máquina física opera de forma autónoma como un nodo de cómputo soberano, garantizando la operación continua incluso sin conexión a internet.\\n\\n#### \*\*1.2. Problema Operacional Resuelto\*\*\\nEl tejido comercial minorista y logístico en América Latina padece de una asfixia operativa causada por la intermitencia de los enlaces de internet. Los sistemas ERP y POS tradicionales colapsan cuando la red falla, provocando pérdidas transaccionales críticas. BUNKKER E.C.O.S soluciona esta vulnerabilidad fundamental asegurando la \*\*resiliencia operativa total\*\* sin depender de una conexión estable a la red pública.\\n\\n#### \*\*1.3. Visión: La Red Neuronal del Retail\*\*\\nEl ecosistema distribuye la carga transaccional y analítica a nivel de hardware local (Edge Computing) en lugar de centralizarla en macro-servidores. Al enlazar múltiples sucursales, las unidades de retail se integran en una matriz inteligente que optimiza las cadenas de suministro regionales, reduce costos logísticos y empodera al comercio local frente a los gigantes del e-commerce.\\n\\n---\\n\\n### \*\*2. Arquitectura Técnica e Ingeniería de Sistemas\*\*\\n\\n#### \*\*2.1. Matriz Operacional Descentralizada (D.O.M.)\*\*\\nLa columna vertebral del sistema es la \*\*Matriz Operacional Descentralizada (D.O.M.)\*\*. Cada terminal (POS, dispositivo de inventario, etc.) opera en modo aislado utilizando un mecanismo de registro de escritura anticipada (Write-Ahead Logging - WAL). En caso de desconexión, el sistema sigue procesando transacciones sobre una base de datos local.\\n\\nPara la reconciliación posterior, se implementa una \*\*cadena de hashes\*\* que garantiza la inmutabilidad y el orden cronológico de las operaciones. Cada bloque de transacciones se valida con la siguiente ecuación:\\n\\n`H\_n = SHA256( id\_n × monto\_n × marca\_tiempo\_n × usuario\_id\_n × H\_n−1 )`\\n\\nDonde cada transacción `H\_n` requiere del hash de la transacción anterior `H\_n−1` para ser admitida, previniendo fraudes y duplicaciones.\\n\\nPara manejar conflictos de concurrencia (ej., dos nodos offline intentando vender el último artículo en stock), el sistema aplica una política de \*\*\\"primero en llegar, primero en ser servido\\" (First-Come, First-Served)\*\* durante la reconciliación. La transacción con la marca de tiempo (`timestamp`) más antigua que se sincroniza con éxito se considera la ganadora. Las transacciones posteriores que entren en conflicto (ej., intentando vender un producto sin stock) son rechazadas y marcadas para revisión manual por un administrador, garantizando la consistencia del inventario.\\n\\n#### \*\*2.2. Arquitectura Multi-Vault (Persistencia de Datos Híbrida)\*\*\\nEl almacenamiento se gestiona a través de tres bóvedas coordinadas:\\n\\n1.  \*\*SQLite / IndexedDB (Bóveda Local):\*\* Base de datos embebida en el cliente para operaciones instantáneas (<70ms) sin latencia de red. Es el motor primario de la operación diaria.\\n2.  \*\*Prisma ORM (Capa de Abstracción):\*\* Orquesta las transacciones para garantizar que las mutaciones complejas (ej. descuento de inventario en una venta) sean atómicas, consistentes, aisladas y duraderas (ACID).\\n3.  \*\*Google Cloud Firestore (Bóveda en la Nube):\*\* Actúa como un repositorio pasivo y asíncrono. No gestiona la transaccionalidad en tiempo real, sino que recibe respaldos y metadatos de sincronización, manteniendo los costos de operación en la nube al mínimo.\\n\\n#### \*\*2.3. Motor de Sincronización Local-First\*\*\\nEl \*\*Nodo Maestro\*\* de un establecimiento levanta un servidor en un puerto aleatorio (`3000`-`3020`) en la red local (LAN). Los \*\*Nodos Esclavos\*\* escanean la subred, detectan al maestro y se conectan automáticamente sin configuración manual. La comunicación interna, como el chat de voz tipo \\"Walkie-Talkie\\", opera exclusivamente sobre esta red local, sin consumir ancho de banda de internet.\\n\\n#### \*\*2.4. Motor de Clasificación con Inteligencia Artificial (AI Edge Engine)\*\*\\nPara automatizar la ingesta de catálogos, el sistema incorpora un orquestador de IA híbrido:\\n\*   \*\*Procesamiento Local (Edge):\*\* Utiliza expresiones regulares (Regex) y heurística para clasificar productos directamente en el dispositivo, extrayendo medidas, materiales y atributos sin necesidad de internet.\\n\*   \*\*Fallback a la Nube:\*\* Si el dispositivo tiene conexión y el usuario cuenta con una licencia PRO, el sistema puede consultar modelos de IA avanzados (como GPT-4o-mini) para una clasificación más precisa, con una degradación elegante al motor local si la red falla.\\n\\n---\\n\\n#### \*\*2.5. Mecanismo de Conmutación por Error de Alta Disponibilidad (Hot Standby)\*\*\\nPara maximizar el tiempo de actividad (uptime) y minimizar la interrupción del servicio ante una falla de hardware del \*\*Nodo Maestro\*\*, el sistema implementa un protocolo de conmutación por error semi-automático conocido como \\"Heredero al Trono\\" o Hot Standby.\\n\\n1.  \*\*Designación de Sucesores:\*\* Una o más terminales con capacidad de cómputo suficiente (ej. la PC de la gerencia) son pre-configuradas como nodos \\"sucesores\\". Estas terminales operan normalmente como Nodos Esclavos, pero tienen el software completo para actuar como Maestro.\\n\\n2.  \*\*Monitoreo Activo (Heartbeat):\*\* Todos los nodos de la red local envían periódicamente una señal de \\"latido\\" (heartbeat) al Nodo Maestro. Si un nodo sucesor no recibe respuesta del Maestro después de un número determinado de intentos (ej. 3 intentos en 15 segundos), asume que el Maestro ha caído.\\n\\n3.  \*\*Alerta y Activación Manual:\*\* Al detectar la caída, la interfaz del nodo sucesor muestra una alerta visible únicamente para roles de `admin` o `superadmin`. Esta alerta presenta un botón de acción: \*\*\\"\[TOMAR CONTROL COMO NUEVO SERVIDOR MAESTRO]\\"\*\*. Esta intervención manual es crucial para prevenir condiciones de \\"cerebro dividido\\" (split-brain) y asegurar que solo un administrador autorizado pueda iniciar la transición.\\n\\n4.  \*\*Coronación Instantánea:\*\* Al presionar el botón, el nodo sucesor ejecuta un script de \\"coronación\\" que:\\n    \*   Establece una conexión directa con la base de datos centralizada en la red (la USB en el módem).\\n    \*   Carga el estado más reciente y se apropia del bloqueo de escritura.\\n    \*   Levanta los servicios de servidor (API, Sockets para Walkie-Talkie, etc.).\\n    \*   Se anuncia en la red local como el nuevo y único Nodo Maestro.\\n\\nEste mecanismo transforma un proceso de recuperación manual que podría tardar varios minutos (reinstalación, restauración de backup) en una transición controlada que se completa en menos de 15 segundos, garantizando la continuidad del negocio con una interrupción casi imperceptible.\\n\\n#### \*\*2.6. Gestión de Sesiones de Larga Duración para Sincronización Offline\*\*\\nPara resolver el desafío de los tokens de autenticación de corta duración (típicamente 1 hora), que impedirían la sincronización de un nodo que ha estado offline por periodos prolongados, el sistema implementa un mecanismo de renovación automática de sesiones.\\n\\n1.  \*\*Obtención de Refresh Token:\*\* Al iniciar sesión, el dispositivo cliente no solo obtiene un `idToken` de corta duración, sino también un `refreshToken` de larga duración, el cual se almacena de forma segura y encriptada en el almacenamiento local del dispositivo.\\n\\n2.  \*\*Verificación Previa a la Sincronización:\*\* Antes de ejecutar una operación crítica que requiera autenticación (como llamar a la API `/api/sales/sync`), el cliente primero verifica localmente la fecha de expiración del `idToken` que posee.\\n\\n3.  \*\*Renovación Silenciosa:\*\* Si el `idToken` ha expirado o está a punto de hacerlo, el cliente utiliza el `refreshToken` para solicitar silenciosamente un nuevo `idToken` válido a los servicios de autenticación de Firebase. Este proceso es completamente transparente para el usuario.\\n\\n4.  \*\*Ejecución con Token Válido:\*\* Una vez obtenido el nuevo `idToken`, el cliente procede a realizar la llamada a la API de sincronización.\\n\\nEsta estrategia garantiza que un dispositivo pueda permanecer offline durante días o incluso semanas y, al momento de recuperar la conectividad, pueda re-autenticarse de forma automática y sincronizar sus datos exitosamente sin requerir una nueva intervención del usuario.\\n\\n---\\n\\n### \*\*3. Modelo de Negocio y Viabilidad de Mercado\*\*\\n\\n#### \*\*3.1. Segmentación de Mercado (LATAM)\*\*\\n\*   \*\*TAM (Total Addressable Market):\*\* Más de 5 millones de PyMEs, ferreterías y bodegas en LATAM con sistemas obsoletos o sin resiliencia offline.\\n\*   \*\*SAM (Serviceable Addressable Market):\*\* Establecimientos en zonas con infraestructura de red deficiente o saturada.\\n\*   \*\*SOM (Serviceable Obtainable Market):\*\* Clústeres comerciales en corredores logísticos estratégicos.\\n\\n#### \*\*3.2. Modelo de Ingresos\*\*\\n1.  \*\*Suscripción Mensual (SaaS):\*\* Licencias Estándar y PRO, esta última con acceso a timbrado fiscal masivo y al motor de IA en la nube.\\n2.  \*\*Comisiones de Red:\*\* Micro-cobros por orquestar operaciones logísticas compartidas entre nodos de la red.\\n3.  \*\*Data Insights Premium:\*\* Acceso a análisis de tendencias de mercado para grandes proveedores, de forma anónima y agregada.\\n\\n---\\n\\n### \*\*4. Compendio de Código Fuente Estructural\*\*\\n\\nA continuación, se presentan las piezas de código que implementan la lógica fundamental del sistema.\\n\\n#### \*\*4.1. Interceptor de Seguridad y Ruteo Multi-Tenant (`src/middleware.ts`)\*\*\\nEste middleware controla el acceso perimetral. Extrae el `x-tenant-id` del subdominio, lo inyecta en las peticiones y aplica reglas de control de acceso basado en roles (RBAC) para proteger las rutas del dashboard.\\n\\n```typescript\\nimport { NextResponse } from \\'next/server\\';\\nimport type { NextRequest } from \\'next/server\\';\\nconst ROLE\_PERMISSIONS: Record<string, string\[]> = {\\n    \\'/dashboard/guia\\': \[\\'superadmin\\'],\\n    \\'/dashboard/inventory\\': \[\\'superadmin\\', \\'admin\\', \\'inventory\\'],\\n    \\'/dashboard/sales\\': \[\\'superadmin\\', \\'admin\\', \\'sales\\'],\\n    \\'/dashboard/audit\\': \[\\'superadmin\\', \\'admin\\', \\'billing\\'],\\n    \\'/dashboard/users\\': \[\\'superadmin\\', \\'admin\\'],\\n    \\'/dashboard/patio\\': \[\\'superadmin\\', \\'carga\_descarga\\', \\'driver\\', \\'inventory\\'],\\n    \\'/dashboard/delivery\\': \[\\'superadmin\\', \\'driver\\', \\'carga\_descarga\\'],\\n    \\'/dashboard/marketing\\': \[\\'superadmin\\', \\'marketing\\', \\'admin\\'],\\n    \\'/dashboard/reports\\': \[\\'superadmin\\'],\\n};\\n\\nconst PUBLIC\_DOMAINS = new Set(\[\\'admin.com\\', \\'localhost:3000\\', \\'www.admin.com\\', \\'admin-com-erp.vercel.app\\']);\\nconst LOGIN\_URL = \\'/login\\';\\nconst UNAUTHORIZED\_URL = \\'/login?error=unauthorized\\';\\nconst DASHBOARD\_URL = \\'/dashboard\\';\\n\\nfunction getTenantId(req: NextRequest): string {\\n    const hostname = req.headers.get(\\'host\\') || \\'\\';\\n    if (!PUBLIC\_DOMAINS.has(hostname) \&\& hostname.includes(\\'.admin.com\\')) {\\n        return hostname.split(\\'.\\')\[0];\\n    }\\n    return req.nextUrl.searchParams.get(\\'tenant\\') || \\'default\\';\\n}\\n\\nexport default function middleware(request: NextRequest) {\\n    const { pathname } = request.nextUrl;\\n    const tenantId = getTenantId(request);\\n    const requestHeaders = new Headers(request.headers);\\n    requestHeaders.set(\\'x-tenant-id\\', tenantId);\\n\\n    if (pathname.startsWith(DASHBOARD\_URL)) {\\n        const session = request.cookies.get(\\'msj-session\\')?.value;\\n        if (!session) {\\n            return NextResponse.redirect(new URL(LOGIN\_URL, request.url));\\n        }\\n\\n        const role = request.cookies.get(\\'msj-role\\')?.value;\\n        if (!role) {\\n            return NextResponse.redirect(new URL(UNAUTHORIZED\_URL, request.url));\\n        }\\n\\n        if (role === \\'superadmin\\') {\\n            return NextResponse.next({ request: { headers: requestHeaders } });\\n        }\\n\\n        const requiredRoles = Object.entries(ROLE\_PERMISSIONS).find((\[path]) => pathname.startsWith(path))?.\[1];\\n\\n        if (requiredRoles) {\\n            if (!requiredRoles.includes(role)) {\\n                return NextResponse.redirect(new URL(UNAUTHORIZED\_URL, request.url));\\n            }\\n        } else if (pathname === DASHBOARD\_URL \&\& role !== \\'admin\\') {\\n            // Redirect non-admins from the main dashboard to their primary page\\n            const primaryPath = Object.entries(ROLE\_PERMISSIONS).find((\[\_, roles]) => roles.includes(role))?.\[0];\\n            return NextResponse.redirect(new URL(primaryPath || UNAUTHORIZED\_URL, request.url));\\n        }\\n    }\\n\\n    const response = NextResponse.next({ request: { headers: requestHeaders } });\\n    response.headers.set(\\'x-tenant-id\\', tenantId);\\n    return response;\\n}\\nexport const config = { matcher: \[\\'/((?!api|\_next/static|\_next/image|favicon.ico).\*)\\'] };\\n```\\n\\n#### \*\*4.2. Bóveda Criptográfica y Reconciliación Offline (`src/app/api/sales/sync/route.ts`)\*\*\\nEste endpoint recibe lotes de ventas generadas offline. Valida la integridad de la \\"cadena de hashes\\" para cada transacción antes de confirmarla en la base de datos central, previniendo manipulaciones.\\n\\n```typescript\\nimport { NextResponse } from \\'next/server\\';\\nimport { auth, db } from \\'@/lib/firebase-admin\\';\\nimport crypto from \\'crypto\\';\\n\\ninterface OfflineSale {\\n    id: string;\\n    amount: number;\\n    paymentMethod: \\'Efectivo\\' | \\'Transferencia\\';\\n    timestamp: string;\\n    hash: string;\\n    previousHash: string;\\n}\\n\\nconst AUTHORIZED\_ROLES = new Set(\[\\'superadmin\\', \\'admin\\', \\'sales\\', \\'patio\\']);\\n\\nexport async function POST(req: Request) {\\n    try {\\n        const tenantId = req.headers.get(\\'x-tenant-id\\');\\n        if (!tenantId) {\\n            return NextResponse.json({ error: \\'Falta Tenant ID\\' }, { status: 400 });\\n        }\\n\\n        const authHeader = req.headers.get(\\'Authorization\\');\\n        if (!authHeader?.startsWith(\\'Bearer \\')) {\\n            return NextResponse.json({ error: \\'No autorizado: Falta Token\\' }, { status: 401 });\\n        }\\n        const idToken = authHeader.split(\\'Bearer \\')\[1];\\n        const decodedToken = await auth.verifyIdToken(idToken);\\n        const userId = decodedToken.uid;\\n        const role = decodedToken.role as string;\\n\\n        if (!AUTHORIZED\_ROLES.has(role)) {\\n            return NextResponse.json({ error: \\'Rol no autorizado para sincronización\\' }, { status: 403 });\\n        }\\n\\n        const { sales }: { sales: OfflineSale\[] } = await req.json();\\n        if (!Array.isArray(sales) || sales.length === 0) {\\n            return NextResponse.json({ message: \\'No hay ventas para sincronizar.\\' }, { status: 200 });\\n        }\\n\\n        const dbRef = db.collection(`tenants/${tenantId}/sales`);\\n        const batch = db.batch();\\n\\n        for (const sale of sales) {\\n            // La lógica original asume que el `userId` del token es el que generó el hash.\\n            // Esto es crucial para la seguridad.\\n            const payloadToHash = `${sale.id}-${sale.amount}-${sale.timestamp}-${userId}-${sale.previousHash}`;\\n            const expectedHash = crypto.createHash(\\'sha256\\').update(payloadToHash).digest(\\'hex\\');\\n\\n            if (sale.hash !== expectedHash) {\\n                console.error(`Fallo de integridad criptográfica en tx: ${sale.id} para user: ${userId}`);\\n                return NextResponse.json({ error: `Fallo de integridad criptográfica en transacción ${sale.id}` }, { status: 400 });\\n            }\\n\\n            const newSaleRef = dbRef.doc(sale.id);\\n            batch.set(newSaleR
