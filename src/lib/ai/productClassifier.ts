import fs from 'fs';
import path from 'path';

// Lista de términos sensibles o inadecuados para el catálogo comercial
const SENSITIVE_WORDS = [
    'sex', 'porn', 'drug', 'terror', 'gay', 'lesbian', 'transsexual', 'trans',
    'judío', 'sperm', 'semen', 'weed', 'cocaine', 'marijuana', 'hitler', 'nazi',
    'violence', 'rape', 'murder', 'suicide', 'abuse', 'vulgar', 'ass', 'bitch',
    'droga', 'terrorista', 'porno', 'violencia', 'suicidio', 'abuso', 'sexo'
];

// Motor de clasificación automática - Basado en el Modelo de Tópicos
export interface ClassificationResult {
    category: string;
    subcategory: string;
    confidence: number;
}

// Caché global en memoria para evitar leer el archivo en cada petición
let cachedTopics: { code: string; words: string[] }[] | null = null;

function loadModelTopics(): { code: string; words: string[] }[] {
    if (cachedTopics) return cachedTopics;

    try {
        const projectRoot = process.cwd();
        const filePath = path.join(
            projectRoot,
            'unsupervised_topic_modeling-master',
            'unsupervised_topic_modeling-master',
            'topics',
            'es',
            '11',
            '100',
            '100',
            'topics'
        );

        if (!fs.existsSync(filePath)) {
            console.warn(`[AI Classifier] Archivo de tópicos no encontrado en: ${filePath}`);
            return [];
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        cachedTopics = lines
            .map(line => {
                const parts = line.trim().split('\t');
                if (parts.length < 2) return null;
                const code = parts[0];
                
                // Limpieza del dataset: Filtrar palabras sensibles
                const words = parts.slice(1)
                    .map(w => w.toLowerCase().replace(/[#?,.:;]/g, ''))
                    .filter(w => {
                        if (!w || w.length < 2) return false;
                        return !SENSITIVE_WORDS.some(sensitive => w.includes(sensitive));
                    });

                return { code, words };
            })
            .filter((t): t is { code: string; words: string[] } => t !== null && t.words.length > 0);

        console.log(`[AI Classifier] Modelo cargado: ${cachedTopics.length} tópicos sanitizados cargados.`);
        return cachedTopics;
    } catch (error) {
        console.error('[AI Classifier] Error cargando modelo de tópicos:', error);
        return [];
    }
}

export function classifyLocalProduct(name: string): ClassificationResult {
    console.log("Procesando clasificación local por modelo de tópicos para:", name);
    
    const topics = loadModelTopics();
    if (!topics || topics.length === 0) {
        return {
            category: "General",
            subcategory: "Sin Clasificar",
            confidence: 0.5
        };
    }

    // Tokenizar el nombre del producto
    const inputWords = name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2); // Excluir palabras muy cortas / preposiciones

    if (inputWords.length === 0) {
        return {
            category: "General",
            subcategory: "Sin Clasificar",
            confidence: 0.1
        };
    }

    let maxMatchCount = 0;
    let matchedTopic: { code: string; words: string[] } | null = null;

    // Buscar el tópico con mayor coincidencia de palabras
    for (const topic of topics) {
        let matchCount = 0;
        for (const inputWord of inputWords) {
            for (const topicWord of topic.words) {
                // Coincidencia exacta o raíz de palabra (restringiendo a palabras de más de 3 caracteres para evitar falsos positivos con conectores/letras sueltas)
                if (topicWord === inputWord || (topicWord.length > 3 && inputWord.length > 3 && (topicWord.startsWith(inputWord) || inputWord.startsWith(topicWord)))) {
                    matchCount++;
                    break;
                }
            }
        }

        if (matchCount > maxMatchCount) {
            maxMatchCount = matchCount;
            matchedTopic = topic;
        }
    }

    // Filtro de seguridad para categorías o subcategorías sensibles
    const isSensitive = (term: string) => {
        const lowerTerm = term.toLowerCase();
        return SENSITIVE_WORDS.some(sensitive => lowerTerm.includes(sensitive));
    };

    if (matchedTopic && maxMatchCount > 0) {
        // Extraer categoría y subcategoría de las palabras más representativas del tópico (limpias de hashtags/menciones)
        const cleanWords = matchedTopic.words
            .filter(w => w && w.length > 1 && !w.startsWith('#') && !w.includes('http') && !w.includes('@'))
            .map(w => w.charAt(0).toUpperCase() + w.slice(1));

        const category = cleanWords[0] || 'General';
        const subcategory = cleanWords[1] || 'Otros';

        // Post-filtro de seguridad
        if (isSensitive(category) || isSensitive(subcategory)) {
            console.warn(`[SECURITY AI] Sugerencia de categoría sensible interceptada y censurada: ${category} / ${subcategory}`);
            return {
                category: "General",
                subcategory: "Sin Clasificar",
                confidence: 0.1
            };
        }

        const confidence = Math.min(1.0, 0.4 + (maxMatchCount / inputWords.length) * 0.6);

        return {
            category,
            subcategory,
            confidence: parseFloat(confidence.toFixed(2))
        };
    }

    return {
        category: "General",
        subcategory: "Sin Clasificar",
        confidence: 0.3
    };
}

export async function classifyProductText(params: { name: string }): Promise<ClassificationResult> {
    return classifyLocalProduct(params.name);
}

export async function logAIClassificationAudit(name: string, result: unknown, userId: string | undefined) {
    console.log(`[AI AUDIT] User: ${userId || 'anonymous'} | Product: ${name} | Result: ${JSON.stringify(result)}`);
}
