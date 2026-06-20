import { NextResponse } from 'next/server';
import { classifyProductText, logAIClassificationAudit } from '@/lib/ai/productClassifier';
import { cookies, headers } from 'next/headers';

/**
 * Endpoint de Clasificación Inteligente
 * POST /api/ai/classify-product
 */
export async function POST(request: Request) {
    try {
        // Detectar si la petición viene por túnel seguro (HTTPS)
        const headersList = await headers();
        const protocol = headersList.get('x-forwarded-proto') || 'http';
        console.log(`[AI API] Solicitud recibida vía ${protocol.toUpperCase()}`);

        const { name } = await request.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Nombre de producto no proporcionado' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        // Obtener el ID de usuario de la sesión para el log
        const cookieStore = await cookies();
        const userId = cookieStore.get('msj-session')?.value;
        const userRole = cookieStore.get('msj-role')?.value;

        // --- VALIDACIÓN DE NIVEL PRO ---
        // Solo permitimos IA remota (GPT-4) a usuarios SuperAdmin o con flag Premium
        const isPro = userRole === 'superadmin'; 

        // --- PASO 1: INTENTO CON IA REMOTA (OPENAI / VERTEX) ---
        if (apiKey && isPro) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini", 
                        messages: [
                            {
                                role: "system",
                                content: "Eres un experto en inventarios industriales. Clasifica el producto en JSON: {category, subcategory, material, measure, confidence}."
                            },
                            {
                                role: "user",
                                content: `Producto: "${name}"`
                            }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const aiResult = JSON.parse(data.choices[0].message.content);
                    const result = { ...aiResult, source: 'remote_ia' };

                    // Guardar en el log de auditoría
                    await logAIClassificationAudit(name, result, userId);
                    return NextResponse.json(result);
                }
            } catch (error) {
                console.error("Falla de IA remota, usando motor local:", error);
            }
        }

        // --- PASO 2: FALLBACK LOCAL (GRATUITO Y OFFLINE) ---
        // Si llegamos aquí es porque no hay internet, no hay key o la IA falló.
        const localResult = await classifyProductText({ name });
        const result = { ...localResult, source: 'local_engine' };
        
        // Delay mínimo para UX fluida
        await new Promise(resolve => setTimeout(resolve, 500));

        await logAIClassificationAudit(name, result, userId);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Error interno en el clasificador' }, { status: 500 });
    }
}
