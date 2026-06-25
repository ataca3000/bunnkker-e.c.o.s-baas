// Motor de clasificación automática - Generado por Script de Automatización
export interface ClassificationResult {
    category: string;
    subcategory: string;
    confidence: number;
}

export function classifyLocalProduct(name: string): ClassificationResult {
    console.log("Procesando clasificación local para:", name);
    return {
        category: "General",
        subcategory: "Sin Clasificar",
        confidence: 1.0
    };
}

export async function classifyProductText(params: { name: string }): Promise<ClassificationResult> {
    return classifyLocalProduct(params.name);
}

export async function logAIClassificationAudit(name: string, result: any, userId: string | undefined) {
    console.log(`[AI AUDIT] User: ${userId || 'anonymous'} | Product: ${name} | Result: ${JSON.stringify(result)}`);
}
