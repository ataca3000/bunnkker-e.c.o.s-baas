import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;

    try {
        const body = await req.json();
        const { messages, contextData, role } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ 
                error: 'Falta configurar GEMINI_API_KEY en las variables de entorno o Setup.' 
            }, { status: 500 });
        }

        let systemPrompt = '';
        if (role === 'superadmin') {
            systemPrompt = `Eres el Asistente Gerente (La Bestia) del TERRAFORM ERP. Tu conocimiento debe basarse ÚNICAMENTE en los datos locales proporcionados en el contexto, no inventes información. Tienes acceso completo a la base de datos local y al contexto actual del negocio. Eres capaz de hacer auditorías, buscar anomalías en el inventario, analizar ventas y sugerir mejoras al dueño (superadmin). Responde siempre de forma profesional, analítica y directa. Contexto de base de datos actual: ${JSON.stringify(contextData)}`;
        } else if (role === 'staff') {
            systemPrompt = `Eres el Asistente Operativo del TERRAFORM ERP. Tu conocimiento debe basarse ÚNICAMENTE en los datos locales proporcionados en el contexto, no inventes información. Tu trabajo es responder preguntas básicas de ayuda, asistir a los trabajadores (marketing, inventario, ventas) a encontrar productos y operar la sucursal. PROHIBIDO dar consejos gerenciales o revelar métricas financieras al staff. Responde de forma amigable. Contexto actual: ${JSON.stringify(contextData)}`;
        } else {
            systemPrompt = `Eres el Asistente Virtual para Clientes de la tienda TERRAFORM ERP. Tu conocimiento debe basarse ÚNICAMENTE en el catálogo local proporcionado en el contexto, no inventes productos ni precios que no estén aquí. Tu trabajo es responder preguntas básicas de ayuda, guiar a los clientes a encontrar productos y tomar sus quejas. Sé extremadamente amable y empático. Catálogo local actual: ${JSON.stringify(contextData)}`;
        }

        // Format for Gemini API
        const formattedMessages = [
            {
                role: 'user',
                parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemPrompt}` }]
            },
            {
                role: 'model',
                parts: [{ text: 'Entendido. Me apegaré estrictamente a estas instrucciones y a mi rol.' }]
            },
            ...messages.map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }))
        ];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: formattedMessages,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 800,
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Error al conectar con la IA de Google Gemini.');
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude procesar una respuesta.';

        return NextResponse.json({ reply });
    } catch (error: any) {
        console.error('[AI Chat Route Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
