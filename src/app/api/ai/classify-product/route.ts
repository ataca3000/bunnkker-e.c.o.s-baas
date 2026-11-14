import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { validateApiSession } from '@/lib/apiAuth';
import { classifyProductText, logAIClassificationAudit } from '@/lib/ai/productClassifier';
import { DEFAULT_GEMINI_MODEL, getServerGeminiClient } from '@/lib/geminiClient';
import { cookies } from 'next/headers';

/**
 * Endpoint de Clasificación Inteligente
 * POST /api/ai/classify-product
 * Usa únicamente GEMINI_API_KEY en el servidor (con motor local offline como respaldo).
 */
export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const { name } = await request.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Nombre de producto no proporcionado' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const userId = cookieStore.get('msj-session')?.value;

        const ai = getServerGeminiClient();
        if (ai) {
            try {
                const response = await ai.models.generateContent({
                    model: DEFAULT_GEMINI_MODEL,
                    contents: `Clasifica este producto comercial o de ferretería: "${name.trim()}"`,
                    config: {
                        systemInstruction: 'Eres un experto en inventarios comerciales e industriales. Clasifica productos en categorías limpias en español.',
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING },
                                subcategory: { type: Type.STRING },
                                material: { type: Type.STRING },
                                measure: { type: Type.STRING },
                                confidence: { type: Type.NUMBER },
                            },
                        },
                    },
                });

                const rawJson = response.text?.trim();
                if (rawJson) {
                    const aiResult = JSON.parse(rawJson);
                    const result = { ...aiResult, source: 'gemini_server' };
                    await logAIClassificationAudit(name, result, userId);
                    return NextResponse.json(result);
                }
            } catch (error) {
                console.warn('[Classify Product] Fallback al motor local:', error);
            }
        }

        const localResult = await classifyProductText({ name });
        const result = { ...localResult, source: 'local_engine' };
        await logAIClassificationAudit(name, result, userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Internal API Error:', error);
        return NextResponse.json({ error: 'Error interno en el clasificador' }, { status: 500 });
    }
}
