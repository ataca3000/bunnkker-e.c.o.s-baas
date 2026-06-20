import { logAudit } from '@/lib/audit';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

export type ProductClassificationResult = {
    category: string;
    subcategory: string;
    material: string;
    measure: string;
    sku: string;
    confidence: number;
    source: string;
};

const CATEGORY_RULES = [
    {
        category: 'Fontanería',
        subcategory: 'Tubería', 
        keywords: ['tubo', 'cople', 'rosca', 'valvula', 'válvula', 'manguera', 'acople', 'pvc', 'cpvc', 'niple', 'reduccion', 'tee', 'flotador', 'bomba', 'galvanizado']
    },
    {
        category: 'Tornillería',
        subcategory: 'Tornillo',
        keywords: ['pija', 'tornillo', 'tuerca', 'arandela', 'perno', 'hex', 'allen', 'taquete', 'clavo', 'remache']
    },
    {
        category: 'Eléctrico',
        subcategory: 'Cable',
        keywords: ['cable', 'conductor', 'interruptor', 'enchufe', 'tomacorriente', 'foco', 'led', 'breaker', 'contacto', 'canaleta', 'socket']
    },
    {
        category: 'Materiales de Construcción',
        subcategory: 'Acabados',
        keywords: ['cemento', 'yeso', 'malla', 'impermeabilizante', 'pintura', 'adhesivo', 'pegamento', 'cal', 'varilla', 'arena', 'grava']
    },
    {
        category: 'Herramientas',
        subcategory: 'Manuales',
        keywords: ['taladro', 'martillo', 'llave', 'cortadora', 'serrucho', 'sierra', 'destornillador', 'pinzas', 'esmeril', 'nivel', 'flexometro']
    },
    {
        category: 'Seguridad',
        subcategory: 'EPP',
        keywords: ['guante', 'casco', 'lentes', 'chaleco', 'bota', 'mascarilla', 'arnes', 'faja']
    },
    {
        category: 'Cerrajería',
        subcategory: 'Chapas',
        keywords: ['chapa', 'cerradura', 'candado', 'llave', 'bisagra', 'pasador']
    }
];

const MATERIAL_RULES = [
    { material: 'Galvanizado', keywords: ['galvanizado', 'galvaniza'] },
    { material: 'Acero', keywords: ['acero', 'inox', 'inoxidable', 'steel'] },
    { material: 'Cobre', keywords: ['cobre'] },
    { material: 'PVC', keywords: ['pvc'] },
    { material: 'Plástico', keywords: ['plástico', 'plastico'] },
    { material: 'Madera', keywords: ['madera'] },
];

const DEFAULT_CLASSIFICATION = {
    category: 'General',
    subcategory: 'General',
    material: 'General',
    measure: 'N/A',
};

function generateSuggestedSKU(name: string, category: string): string {
    const prefix = category.substring(0, 3).toUpperCase();
    const cleanName = normalizeText(name)
        .split(/\s+/)
        .map(word => word.substring(0, 3).toUpperCase())
        .filter(word => word.length > 1)
        .join('-')
        .slice(0, 10);
    return `${prefix}-${cleanName}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeText(text: string) {
    return text
        .trim()
        .toLowerCase()
        .replace(/á/g, 'a')
        .replace(/é/g, 'e')
        .replace(/í/g, 'i')
        .replace(/ó/g, 'o')
        .replace(/ú/g, 'u')
        .replace(/ü/g, 'u');
}

function tokenize(text: string): string[] {
    return normalizeText(text)
        .split(/\s+/)
        .filter(word => word.length > 2) // Ignorar conectores cortos como "de", "con"
        .map(word => word.replace(/[^a-z0-9]/g, ''));
}

function extractMeasure(text: string) {
    const measurePatterns = [
        /(\d+(?:[\.,]\d+)?)(\s?(?:mm|cm|m|pulg|"|in|kg|gr|l|ml))/i,
        /(1\/2|3\/4|1\/4|5\/16|5\/8|3\/8|7\/8|1\s1\/2|1\s1\/4|2")/i,
        /(\d+\s?x\s?\d+)/i,
        /(\d+)\s?pzas/i,
        /(\d+)\s?mts/i
    ];

    for (const pattern of measurePatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0].replace(/\s+/g, '').toUpperCase();
        }
    }

    return 'N/A';
}

function findCategory(text: string) {
    for (const rule of CATEGORY_RULES) {
        for (const keyword of rule.keywords) {
            const keywordLower = keyword.toLowerCase();
            const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
            if (regex.test(text)) {
                const isHighConfidence = text.startsWith(keywordLower);
                return {
                    category: rule.category,
                    subcategory: rule.subcategory,
                    score: isHighConfidence ? 1.5 : 1
                };
            }
        }
    }
    return { category: DEFAULT_CLASSIFICATION.category, subcategory: DEFAULT_CLASSIFICATION.subcategory, score: 0 };
}

function findMaterial(text: string) {
    for (const rule of MATERIAL_RULES) {
        for (const keyword of rule.keywords) {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
            if (regex.test(text)) {
                return { material: rule.material, score: 1 };
            }
        }
    }
    return { material: DEFAULT_CLASSIFICATION.material, score: 0 };
}

async function localClassifier(payload: { name: string; description?: string }): Promise<ProductClassificationResult> {
    const text = normalizeText([payload.name, payload.description].filter(Boolean).join(' '));
    
    // --- NUEVO: CAPA DE ADAPTACIÓN (MEMORIA DE APRENDIZAJE) ---
    try {
        const tokens = tokenize(payload.name).slice(0, 10); // Límite de Firebase para array-contains-any
        const learningRef = collection(db, 'ai_learning');
        
        // Buscamos reglas que contengan las palabras clave del producto actual
        const q = query(
            learningRef, 
            where('isRule', '==', true),
            where('keywords', 'array-contains-any', tokens),
            limit(5)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            // Tomamos la regla con mayor coincidencia o la más reciente
            const learnedData = snapshot.docs[0].data(); 
            return {
                category: learnedData.userCorrectedCategory,
                subcategory: 'Sugerencia Aprendida',
                material: findMaterial(text).material,
                measure: extractMeasure(payload.name),
                sku: generateSuggestedSKU(payload.name, learnedData.userCorrectedCategory),
                confidence: 0.95, 
                source: 'learned_keyword_rule',
            };
        }
    } catch (e) { console.error("Error consultando memoria IA:", e); }

    const categoryMatch = findCategory(text);
    const materialMatch = findMaterial(text);
    const measure = extractMeasure(payload.name + ' ' + (payload.description || ''));

    const confidenceBase = 0.5;
    const score = categoryMatch.score + materialMatch.score;
    const confidence = Math.min(1, confidenceBase + score * 0.2);

    return {
        category: categoryMatch.category,
        subcategory: categoryMatch.subcategory,
        material: materialMatch.material,
        measure,
        sku: generateSuggestedSKU(payload.name, categoryMatch.category),
        confidence,
        source: 'local',
    };
}

async function remoteClassifier(payload: { name: string; description?: string }): Promise<ProductClassificationResult> {
    const remoteUrl = process.env.AI_SERVICE_URL;
    if (!remoteUrl) return await localClassifier(payload);

    try {
        const response = await fetch(remoteUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) return await localClassifier(payload);
        const result = await response.json();

        return {
            category: result.category || DEFAULT_CLASSIFICATION.category,
            subcategory: result.subcategory || DEFAULT_CLASSIFICATION.subcategory,
            material: result.material || DEFAULT_CLASSIFICATION.material,
            measure: result.measure || DEFAULT_CLASSIFICATION.measure,
            sku: result.sku || generateSuggestedSKU(payload.name, result.category || DEFAULT_CLASSIFICATION.category),
            confidence: typeof result.confidence === 'number' ? result.confidence : 0.75,
            source: 'remote',
        };
    } catch (error) {
        return await localClassifier(payload);
    }
}

export async function classifyProductText(payload: { name: string; description?: string }): Promise<ProductClassificationResult> {
    if (process.env.AI_SERVICE_URL) {
        return await remoteClassifier(payload);
    }
    return await localClassifier(payload);
}

/**
 * Registra el resultado de una clasificación en el log de auditoría del sistema
 */
export async function logAIClassificationAudit(name: string, result: ProductClassificationResult, userId?: string) {
    try {
        await logAudit({
            type: 'AI_CLASSIFICATION',
            userId: userId || 'SYSTEM_AI',
            userName: 'Admin.com AI Service',
            userRole: 'system',
            description: `IA: "${name}" -> [${result.category}] (Confianza: ${(result.confidence * 100).toFixed(0)}%)`,
            metadata: {
                productName: name,
                ...result,
            }
        });

        // Alerta de seguridad si la confianza es muy baja
        if (result.confidence < 0.5) {
            await logAudit({
                type: 'SECURITY_ALERT',
                userId: 'SYSTEM_AI',
                userName: 'IA Sentinel',
                userRole: 'system',
                description: `⚠️ CLASIFICACIÓN DUDOSA: Revisar "${name}". Confianza crítica del ${(result.confidence * 100).toFixed(0)}%`,
                metadata: { productName: name, rawConfidence: result.confidence }
            });
        }

    } catch (error) {
        console.error("Error al registrar auditoría de IA:", error);
    }
}

/**
 * Registra una corrección manual del usuario para mejorar el motor local en el futuro.
 * Guarda qué intentó adivinar la IA y qué eligió el usuario realmente.
 */
export async function recordAICorrection(productName: string, aiGuess: string, userChoice: string) {
    if (aiGuess === userChoice) return; // No hay nada que aprender si acertó

    try {
        const keywords = tokenize(productName);
        await addDoc(collection(db, 'ai_learning'), {
            productName,
            keywords,
            aiSuggestedCategory: aiGuess,
            userCorrectedCategory: userChoice,
            timestamp: serverTimestamp(),
            processed: false,
            isRule: false // Se vuelve true cuando el admin lo aprueba en la nueva pantalla
        });
        console.log(`[AI-Learning] Corrección registrada para "${productName}"`);
    } catch (error) {
        console.error("Error al guardar aprendizaje de IA:", error);
    }
}
