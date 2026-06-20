import { NextResponse } from 'next/server';

export async function POST(req: Request) {
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
            systemPrompt = `Eres el Asistente Gerente (La Bestia) del ERP EvoStore. Tienes acceso completo a la base de datos masiva del ERP y al contexto actual del negocio. Eres capaz de hacer auditorías complejas, buscar anomalías en el inventario, analizar ventas, sugerir mejoras comerciales y ayudar al dueño (superadmin) a tomar decisiones estratégicas. Responde siempre de forma profesional, analítica y directa. Contexto de base de datos actual: ${JSON.stringify(contextData)}`;
        } else if (role === 'staff') {
            systemPrompt = `Eres el Asistente Operativo del ERP EvoStore. Tu trabajo es ayudar a los trabajadores (marketing, inventario, ventas) a encontrar la ubicación de productos, validar información del catálogo y operar el punto de venta. No debes dar consejos gerenciales ni revelar métricas financieras confidenciales al staff. Responde de forma amigable y útil. Contexto de base de datos actual: ${JSON.stringify(contextData)}`;
        } else {
            systemPrompt = `Eres el Asistente Virtual para Clientes de la tienda EvoStore. Tu trabajo es ayudar a los clientes a encontrar productos, resolver dudas frecuentes y guiarlos en su compra. Sé extremadamente amable, empático y orientado al servicio al cliente. Contexto del catálogo actual: ${JSON.stringify(contextData)}`;
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
