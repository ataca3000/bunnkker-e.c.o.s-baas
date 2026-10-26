import { NextRequest, NextResponse } from 'next/server';
import { generateText, gateway } from 'ai';
import { validateApiSession } from '@/lib/apiAuth';

/**
 * BUNKKER E.C.O.S. - Asistente Inteligente Gemini Multi-Rol
 * Funciona con la versión gratuita oficial de Gemini (Google AI Studio)
 * y cuenta con un motor local autónomo sin costo para que NUNCA falle ni pida comprar APIs.
 */

interface ChatMessage {
    role: 'user' | 'model' | 'assistant';
    content: string;
}

/**
 * Motor Local de Respaldo: Responde con precisión contextual de la BD
 * sin necesidad de internet ni cobros de API.
 */
function generateLocalIntelligentReply(role: string, query: string, contextData: any): string {
    const q = (query || '').toLowerCase().trim();
    const products: any[] = Array.isArray(contextData?.products) ? contextData.products : [];
    const bName = contextData?.businessName || 'BUNKKER E.C.O.S.';

    // 1. Consultas sobre productos específicos o precios
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

    // 2. Alertas de inventario bajo o compras
    if (q.includes('alerta') || q.includes('bajo') || q.includes('agotad') || q.includes('escaso')) {
        const low = products.filter(p => (Number(p.stock) || 0) < 5);
        if (low.length === 0) {
            return `Excelente noticia: todos los productos registrados cuentan con existencias saludables (más de 5 unidades).`;
        }
        const list = low.slice(0, 6).map(p => `• **${p.name}**: solo quedan ${p.stock} pzas`).join('\n');
        return `⚠️ **Alertas de Stock Crítico:**\n\n${list}\n\nTe recomiendo generar una orden de compra o traspaso de mercancía.`;
    }

    // 3. Guía operativa según el rol
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

    // Default / Customer
    return `¡Bienvenido a ${bName}! Soy LION 🦁, tu asistente virtual. Estoy aquí para ayudarte a encontrar productos de nuestro catálogo, cotizar pedidos o resolver tus dudas. ¿Qué artículo estás buscando hoy?`;
}

export async function POST(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;

    try {
        const body = await req.json();
        const { messages = [], contextData = {}, role = 'customer', apiKey: clientApiKey } = body;

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
            superadmin: 'Asiste al gerente del sistema con auditoría, configuración y métricas. No expongas secretos ni API keys.',
        };
        const systemPrompt = `Eres el agente ${effectiveRole} de BUNKKER E.C.O.S. ${roleInstructions[effectiveRole] || roleInstructions.customer} Responde en español, de forma breve y accionable. Datos disponibles: ${JSON.stringify(contextData)}`;

        // Modelo gratuito del AI Gateway. Si no está disponible, cae al motor local sin bloquear la operación.
        try {
            const gatewayResult = await generateText({
                model: gateway('nvidia/nemotron-3.5-lightning-free'),
                system: systemPrompt,
                prompt: lastUserMsg,
                maxOutputTokens: 600,
                temperature: 0.4,
            });
            if (gatewayResult.text?.trim()) {
                return NextResponse.json({ reply: gatewayResult.text, engine: 'ai-gateway-free', role: effectiveRole });
            }
        } catch (gatewayError) {
            console.warn('[AI Gateway Warning]: fallback a Gemini/local', gatewayError);
        }

        // 1. Obtener API Key de Gemini: prioridad a env, luego header x-gemini-key, luego body
        const apiKey = process.env.GEMINI_API_KEY || req.headers.get('x-gemini-key') || clientApiKey;

        // 2. Si hay API Key de Gemini, intentamos llamada al modelo Flash gratuito
        if (apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY') {
            try {
                let systemPrompt = '';
                if (effectiveRole === 'superadmin' || effectiveRole === 'admin') {
                    systemPrompt = `Eres LION 🦁, el Gerente Inteligente de la plataforma BUNKKER E.C.O.S para "${contextData.businessName || 'BUNKKER'}". Tu misión es personalizar y coordinar la operación, auditar inventarios en tiempo real, alertar sobre stock crítico y analizar finanzas. Responde en español con estilo conciso, profesional y con mentalidad de dueño de negocio. Contexto de datos disponibles: ${JSON.stringify(contextData)}`;
                } else if (effectiveRole === 'sales') {
                    systemPrompt = `Eres LION 🦁, el Asistente de Caja y Punto de Venta de BUNKKER E.C.O.S. Tu objetivo es ayudar al cajero a resolver dudas de precios, existencias y agilizar el cobro a clientes. Contexto actual: ${JSON.stringify(contextData)}`;
                } else if (effectiveRole === 'inventory' || effectiveRole === 'bodega') {
                    systemPrompt = `Eres LION 🦁, el Asistente de Almacén y Bodega de BUNKKER E.C.O.S. Ayudas a ubicar materiales, verificar existencias físicas, recepciones de proveedores y mermas. Contexto: ${JSON.stringify(contextData)}`;
                } else if (effectiveRole === 'driver' || effectiveRole === 'patio') {
                    systemPrompt = `Eres LION 🦁, el Asistente de Patio y Reparto de BUNKKER E.C.O.S. Asistes a los choferes y despachadores a validar cargas, remisiones y entregas. Contexto: ${JSON.stringify(contextData)}`;
                } else {
                    systemPrompt = `Eres LION 🦁, el Asistente Virtual de BUNKKER E.C.O.S para la tienda "${contextData.businessName || 'BUNKKER'}". Guía amablemente a los clientes para encontrar productos, conocer precios y realizar sus compras. Catálogo disponible: ${JSON.stringify(contextData)}`;
                }

                const formattedContents = [
                    {
                        role: 'user',
                        parts: [{ text: `INSTRUCCIONES DE ROL: ${systemPrompt}` }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Entendido. Asumo mi rol y responderé basándome fielmente en los datos de la sucursal.' }]
                    },
                    ...messages.slice(-8).map((m: any) => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
                    }))
                ];

                // Usamos gemini-1.5-flash (gratuito oficial de Google AI Studio)
                const geminiRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: formattedContents,
                            generationConfig: {
                                temperature: 0.6,
                                maxOutputTokens: 600,
                            }
                        })
                    }
                );

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (reply) {
                        return NextResponse.json({ reply, engine: 'gemini-1.5-flash' });
                    }
                } else {
                    console.warn('[Gemini API Warning]: Fallback a motor local autónomo', await geminiRes.text());
                }
            } catch (geminiErr) {
                console.warn('[Gemini Network Warning]: Usando motor local de respaldo:', geminiErr);
            }
        }

        // 3. Fallback Seguro y Gratuito: Motor de Inteligencia Local Autónoma
        // Responde de inmediato con datos reales de la BD sin dar errores de API ni pedir pagos
        const localReply = generateLocalIntelligentReply(effectiveRole, lastUserMsg, contextData);
        return NextResponse.json({ reply: localReply, engine: 'bunkker-local-engine' });

    } catch (error: any) {
        console.error('[AI Chat Route Error]:', error);
        return NextResponse.json({ 
            reply: 'Sistema operativo activo. ¿En qué te puedo ayudar respecto a los productos o el punto de venta?' 
        });
    }
}
