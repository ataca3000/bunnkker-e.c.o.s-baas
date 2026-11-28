import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { DEFAULT_GEMINI_MODEL, getServerGeminiClient } from '@/lib/geminiClient';
import { buildLionSystemInstruction } from '@/lib/lionSystemPrompt';

/**
 * BUNKKER E.C.O.S. - Asistente Inteligente Gemini Multi-Rol
 * Usa exclusivamente GEMINI_API_KEY en el servidor (@google/genai)
 * y cuenta con un motor local autónomo para operar sin internet ni llaves extra.
 */

function generateLocalIntelligentReply(role: string, query: string, contextData: any): string {
    const q = (query || '').toLowerCase().trim();
    const products: any[] = Array.isArray(contextData?.products) ? contextData.products : [];
    const bName = contextData?.businessName || 'BUNKKER E.C.O.S.';

    const matchedProducts = products.filter(p => {
        if (!p?.name) return false;
        const words = p.name.toLowerCase().split(/\s+/);
        return words.some((w: string) => w.length > 2 && q.includes(w));
    });

    if (matchedProducts.length > 0) {
        if (q.includes('precio') || q.includes('cuanto') || q.includes('cuesta')) {
            const list = matchedProducts.slice(0, 5).map(p =>
                `• **${p.name}**: $${Number(p.price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (Stock: ${p.stock ?? 'N/A'})`
            ).join('\n');
            return `Aquí tienes los precios consultados en ${bName}:\n\n${list}`;
        }

        if (q.includes('stock') || q.includes('cuantos') || q.includes('hay') || q.includes('queda') || q.includes('inventario') || q.includes('donde') || q.includes('ubicacion')) {
            const list = matchedProducts.slice(0, 5).map(p =>
                `• **${p.name}**: ${p.stock ?? 0} unidades disponibles ${p.location ? `(Ubicación: ${p.location})` : ''}`
            ).join('\n');
            return `Disponibilidad actual en sistema:\n\n${list}`;
        }
    }

    if (q.includes('alerta') || q.includes('bajo') || q.includes('agotad') || q.includes('escaso')) {
        const low = products.filter(p => (Number(p.stock) || 0) < 5);
        if (low.length === 0) {
            return `Excelente noticia: todos los productos registrados cuentan con existencias saludables (más de 5 unidades).`;
        }
        const list = low.slice(0, 6).map(p => `• **${p.name}**: solo quedan ${p.stock} pzas`).join('\n');
        return `⚠️ **Alertas de Stock Crítico:**\n\n${list}\n\nTe recomiendo generar una orden de compra o traspaso de mercancía.`;
    }

    if (role === 'superadmin' || role === 'admin') {
        if (q.includes('corte') || q.includes('caja') || q.includes('dinero')) {
            return `Para realizar el corte de caja:\n1. Dirígete a **Punto de Venta / Ventas** o **Reportes**.\n2. Presiona el botón de **Cierre de Caja** para conciliar efectivo, tarjeta y transferencias.\n3. El sistema generará el ticket de corte y registrará el arqueo en la auditoría inmutable.`;
        }
        if (q.includes('migra') || q.includes('respaldo') || q.includes('celular') || q.includes('dispositivo')) {
            return `Para clonar o respaldar esta terminal en un nuevo celular:\n1. Ve a **/dashboard/migracion**.\n2. Muestra el código QR generado.\n3. Abre la cámara del dispositivo nuevo para restaurar todo con **Zero-Tap Restore** en un segundo.`;
        }
        return `Hola Jefe, soy LION 🦁. Estoy monitoreando tu sucursal en ${bName}. El catálogo cuenta con ${products.length} productos registrados. Puedo ayudarte a auditar inventarios, verificar precios o darte alertas operativas. ¿Qué deseas revisar?`;
    }

    if (role === 'sales') {
        if (q.includes('cambio') || q.includes('cobrar') || q.includes('ticket')) {
            return `Para cobrar rápidamente:\n1. Escanea o busca los productos en el buscador superior.\n2. Agrega al carrito y presiona **Cobrar (F12 o botón)**.\n3. Ingresa el monto recibido para calcular el cambio exacto y emite el ticket físico o digital.`;
        }
        return `¡Listo en Caja! Soy LION 🦁, preparado para ayudarte a consultar existencias rápidas, ubicaciones de productos o precios para agilizar la fila de cobro.`;
    }

    if (role === 'inventory' || role === 'bodega') {
        return `Soy LION 🦁 en Bodega. Tienes ${products.length} artículos en catálogo. Pregúntame por cualquier material (cemento, varilla, herramientas) para decirte cuántas piezas hay registradas y sus ubicaciones en estante.`;
    }

    if (role === 'driver' || role === 'patio') {
        return `Soy LION 🦁 en Logística y Patio. Revisa tu lista de remisiones y pedidos asignados para verificar que la carga en batea coincida antes de salir a ruta.`;
    }

    return `¡Bienvenido a ${bName}! Soy LION 🦁, tu asistente virtual. Estoy aquí para ayudarte a encontrar productos de nuestro catálogo, cotizar pedidos o resolver tus dudas. ¿Qué artículo estás buscando hoy?`;
}

export async function POST(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;

    try {
        const body = await req.json();
        const { messages = [], contextData = {}, role = 'customer' } = body;

        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
        const effectiveRole = String(role).toLowerCase();

        const roleInstructions: Record<string, string> = {
            customer: 'Ayuda a clientes a encontrar productos, consultar precios y preparar pedidos. Nunca inventes stock ni confirmes pagos.',
            support: 'Atiende soporte a clientes con respuestas claras, consulta el contexto disponible y escala incidencias que requieran permisos.',
            sales: 'Asiste a caja con precios, existencias y cobro. Nunca autorices descuentos, devoluciones o cambios sin confirmación humana.',
            cashier: 'Asiste a caja con precios, existencias y cobro. Nunca autorices descuentos, devoluciones o cambios sin confirmación humana.',
            inventory: 'Asiste al almacén con existencias, ubicaciones, recepción y mermas. No modifiques inventario sin autorización.',
            warehouse: 'Asiste al almacén con existencias, ubicaciones, recepción y mermas. No modifiques inventario sin autorización.',
            driver: 'Asiste al repartidor con rutas, pedidos y evidencias. No marques una entrega como completada sin confirmación.',
            delivery: 'Asiste al repartidor con rutas, pedidos y evidencias. No marques una entrega como completada sin confirmación.',
            owner: 'Asiste al dueño con resúmenes, alertas y decisiones operativas. Separa hechos del contexto de cualquier recomendación.',
            admin: 'Asiste al gerente con auditoría, inventario, ventas y finanzas. No ejecutes acciones irreversibles.',
            superadmin: 'Asiste al gerente del sistema con auditoría, configuración y métricas. No expongas secretos ni llaves internas.',
        };

        const ai = getServerGeminiClient();
        if (ai) {
            try {
                const systemInstruction = buildLionSystemInstruction(effectiveRole, contextData);
                const historyText = messages
                    .slice(-8)
                    .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'LION'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
                    .join('\n');

                const response = await ai.models.generateContent({
                    model: DEFAULT_GEMINI_MODEL,
                    contents: historyText || lastUserMsg,
                    config: {
                        systemInstruction,
                    },
                });

                const reply = response.text?.trim();
                if (reply) {
                    return NextResponse.json({ reply, engine: DEFAULT_GEMINI_MODEL, role: effectiveRole });
                }
            } catch (geminiErr) {
                console.warn('[Gemini Server Warning]: Usando motor local de respaldo:', geminiErr);
            }
        }

        const localReply = generateLocalIntelligentReply(effectiveRole, lastUserMsg, contextData);
        return NextResponse.json({ reply: localReply, engine: 'bunkker-local-engine', role: effectiveRole });
    } catch (error: any) {
        console.error('[AI Chat Route Error]:', error);
        return NextResponse.json({
            reply: 'Sistema operativo activo. ¿En qué te puedo ayudar respecto a los productos o el punto de venta?',
        });
    }
}
