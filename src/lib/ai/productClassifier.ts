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
