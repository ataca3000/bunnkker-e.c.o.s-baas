/**
 * Helper para llamar al servicio de clasificación de productos por IA
 */
export async function classifyProduct(name: string) {
    try {
        const response = await fetch('/api/ai/classify-product', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor de IA');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("AI Classification Error:", error);
        throw error;
    }
}
