/**
 * OMNIPULSE — Motor de Variación de Contenido (Spintax Engine)
 * Genera permutaciones únicas del mismo mensaje para cada red social,
 * reduciendo la huella de contenido duplicado y evitando filtros anti-spam.
 */

/**
 * Resuelve una plantilla Spintax generando una variación única del mensaje.
 * Patrón de variantes: {opcion1|opcion2|opcion3}
 * Variables dinámicas: {{nombre_variable}}
 *
 * @example
 * Input:  "{Hola|Buen día|Qué tal} {{nombre}}, {conoce|descubre|visita} nuestro catálogo."
 * Output: "Buen día Ferretería Norte, visita nuestro catálogo."
 */
export function resolveSpintax(template: string, vars: Record<string, string> = {}): string {
    let output = '';
    let i = 0;
    const len = template.length;

    while (i < len) {
        if (template[i] === '{' && template[i + 1] === '{') {
            const end = template.indexOf('}}', i + 2);
            if (end !== -1) {
                const key = template.slice(i + 2, end).trim();
                output += vars[key] ?? `[${key}]`;
                i = end + 2;
                continue;
            }
        } else if (template[i] === '{') {
            const end = template.indexOf('}', i + 1);
            if (end !== -1) {
                const block = template.slice(i + 1, end);
                const options = block.split('|');
                output += options[Math.floor(Math.random() * options.length)];
                i = end + 1;
                continue;
            }
        }
        output += template[i];
        i++;
    }

    return output;
}

/**
 * Genera N variaciones distintas de la misma plantilla Spintax.
 * Útil para previsualizar el rango de mensajes posibles antes de publicar.
 */
export function generateVariations(template: string, count: number = 5, vars: Record<string, string> = {}): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    let attempts = 0;
    const maxAttempts = count * 10;

    while (results.length < count && attempts < maxAttempts) {
        const variation = resolveSpintax(template, vars);
        if (!seen.has(variation)) {
            seen.add(variation);
            results.push(variation);
        }
        attempts++;
    }

    return results;
}

/**
 * Cuenta el número de combinaciones únicas posibles en una plantilla Spintax.
 */
export function countCombinations(template: string): number {
    let count = 1;
    let i = 0;
    const len = template.length;
    while (i < len) {
        if (template[i] === '{' && template[i + 1] === '{') {
            const end = template.indexOf('}}', i + 2);
            i = end !== -1 ? end + 2 : i + 2;
            continue;
        }
        if (template[i] === '{') {
            const end = template.indexOf('}', i + 1);
            if (end !== -1) {
                const block = template.slice(i + 1, end);
                const options = block.split('|');
                count *= options.length;
                i = end + 1;
                continue;
            }
        }
        i++;
    }
    return count;
}
