import fs from 'fs';
import path from 'path';

// Catálogo de Mapeos de Intención en Código (ERP Modules Mappings)
export interface IntentMapping {
    intent: string;
    label: string;
    terms: string[];
    redirect: string;
}

export const INTENT_MAPPINGS: Record<string, { label: string; terms: string[]; redirect: string }> = {
    'import': {
        label: 'Carga de Inventario / Importación',
        terms: ['importar', 'importacion', 'trasladar', 'traer', 'subir', 'cargar', 'excel', 'csv', 'archivo', 'traspaso', 'traspasar', 'migrar', 'subida'],
        redirect: '/dashboard/inventory'
    },
    'export': {
        label: 'Descarga / Exportación de Datos',
        terms: ['exportar', 'descargar', 'bajar', 'guardar', 'reporte', 'excel', 'csv', 'respaldo', 'backup', 'descarga', 'cierre', 'pdf'],
        redirect: '/dashboard/reports'
    },
    'sales': {
        label: 'Punto de Venta / Caja',
        terms: ['vender', 'cobrar', 'caja', 'pagar', 'venta', 'pos', 'dinero', 'cajero', 'ticket', 'efectivo', 'cambio', 'corte', 'terminal'],
        redirect: '/dashboard/admin/sales'
    },
    'delivery': {
        label: 'Logística de Repartos',
        terms: ['reparto', 'entrega', 'domicilio', 'chofer', 'ruta', 'camion', 'enviar', 'envio', 'repartidor', 'direccion', 'gps', 'envio', 'entrega'],
        redirect: '/dashboard/delivery'
    },
    'billing': {
        label: 'Facturación CFDI / SAT',
        terms: ['factura', 'sat', 'rfc', 'cfdi', 'timbrado', 'fiscal', 'impuesto', 'facturacion', 'facturar', 'sat'],
        redirect: '/dashboard/billing'
    },
    'inventory': {
        label: 'Control de Inventario',
        terms: ['inventario', 'almacen', 'stock', 'producto', 'mercancia', 'bodega', 'lote', 'catalogo', 'existencias', 'estanteria', 'merma'],
        redirect: '/dashboard/inventory'
    },
    'design': {
        label: 'Diseño y Branding',
        terms: ['diseño', 'marca', 'branding', 'logo', 'colores', 'apariencia', 'personalizar', 'tienda', 'canvas', 'tornasol', 'estilo'],
        redirect: '/dashboard/design'
    },
    'marketing': {
        label: 'Marketing QR y Campañas',
        terms: ['marketing', 'qr', 'campaña', 'publicidad', 'volante', 'flyer', 'compartir', 'codigo', 'escaner'],
        redirect: '/dashboard/marketing'
    },
    'audit': {
        label: 'Registro de Auditoría',
        terms: ['auditoria', 'bitacora', 'log', 'historial', 'seguridad', 'acceso', 'registro', 'operaciones', 'forense'],
        redirect: '/dashboard/audit'
    },
    'tests': {
        label: 'Laboratorio de Pruebas',
        terms: ['pruebas', 'laboratorio', 'estres', 'concurrencia', 'carga', 'simulacion', 'test', 'concurrente', 'estresar'],
        redirect: '/dashboard/tests'
    }
};

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
            console.warn(`[Topic Mapper] Archivo de tópicos no encontrado en: ${filePath}`);
            return [];
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        cachedTopics = lines
            .map(line => {
                const parts = line.trim().split('\t');
                if (parts.length < 2) return null;
                const code = parts[0];
                const words = parts.slice(1)
                    .map(w => w.toLowerCase().replace(/[#?,.:;]/g, ''))
                    .filter(w => w && w.length >= 2);
                return { code, words };
            })
            .filter((t): t is { code: string; words: string[] } => t !== null && t.words.length > 0);

        return cachedTopics;
    } catch (error) {
        console.error('[Topic Mapper] Error cargando modelo de tópicos:', error);
        return [];
    }
}

export interface IntentResult {
    intent: string;
    label: string;
    redirect: string;
    confidence: number;
}

export function resolveSemanticIntent(query: string): IntentResult {
    const cleanedQuery = query.toLowerCase().trim();
    if (!cleanedQuery) {
        return {
            intent: 'unknown',
            label: 'Consulta Vacía',
            redirect: '/dashboard',
            confidence: 0.0
        };
    }

    // Tokenizar la query
    const queryWords = cleanedQuery
        .replace(/[^\w\sáéíóúñ]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

    if (queryWords.length === 0) {
        return {
            intent: 'unknown',
            label: 'Consulta muy corta',
            redirect: '/dashboard',
            confidence: 0.1
        };
    }

    let bestIntent: string | null = null;
    let maxScore = 0;

    // ── Paso 1: Coincidencia Directa ─────────────────────────────────────────
    for (const [intent, meta] of Object.entries(INTENT_MAPPINGS)) {
        let directMatchCount = 0;
        for (const word of queryWords) {
            if (meta.terms.includes(word)) {
                directMatchCount++;
            }
        }
        if (directMatchCount > 0) {
            // Puntuación directa alta
            const score = directMatchCount * 3.0;
            if (score > maxScore) {
                maxScore = score;
                bestIntent = intent;
            }
        }
    }

    // ── Paso 2: Asociación Semántica vía Modelo de Tópicos ───────────────────
    const topics = loadModelTopics();
    if (topics && topics.length > 0) {
        let maxTopicMatch = 0;
        let matchedTopic: { code: string; words: string[] } | null = null;

        // Encontrar el tópico que más coincide con la consulta
        for (const topic of topics) {
            let matchCount = 0;
            for (const qWord of queryWords) {
                for (const tWord of topic.words) {
                    if (tWord === qWord || (tWord.length > 3 && qWord.length > 3 && (tWord.startsWith(qWord) || qWord.startsWith(tWord)))) {
                        matchCount++;
                        break;
                    }
                }
            }
            if (matchCount > maxTopicMatch) {
                maxTopicMatch = matchCount;
                matchedTopic = topic;
            }
        }

        // Si encontramos un tópico relacionado semánticamente
        if (matchedTopic && maxTopicMatch > 0) {
            // Comparar el vocabulario del tópico con nuestros términos del ERP
            for (const [intent, meta] of Object.entries(INTENT_MAPPINGS)) {
                let semanticOverlap = 0;
                for (const tWord of matchedTopic.words) {
                    if (meta.terms.includes(tWord)) {
                        semanticOverlap++;
                    }
                }
                
                if (semanticOverlap > 0) {
                    // Puntuación semántica ponderada (coincidencia del tópico + solapamiento semántico)
                    const semanticScore = maxTopicMatch + (semanticOverlap * 0.75);
                    if (semanticScore > maxScore) {
                        maxScore = semanticScore;
                        bestIntent = intent;
                    }
                }
            }
        }
    }

    // ── Paso 3: Retornar resultado ───────────────────────────────────────────
    if (bestIntent && maxScore > 0) {
        const meta = INTENT_MAPPINGS[bestIntent];
        // Calcular confianza basándose en la puntuación y el tamaño de la consulta
        const confidence = Math.min(1.0, 0.35 + (maxScore / Math.max(1, queryWords.length)) * 0.65);
        return {
            intent: bestIntent,
            label: meta.label,
            redirect: meta.redirect,
            confidence: parseFloat(confidence.toFixed(2))
        };
    }

    return {
        intent: 'unknown',
        label: 'No identificado semánticamente',
        redirect: '/dashboard',
        confidence: 0.2
    };
}
