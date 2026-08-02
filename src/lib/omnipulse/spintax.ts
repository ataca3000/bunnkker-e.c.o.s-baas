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
    // Fase 1: Resolver bloques de variantes {opcion1|opcion2}
    let resolved = template.replace(/\{([^}]+)\}/g, (_, block: string) => {
        const options = block.split('|');
        return options[Math.floor(Math.random() * options.length)];
    });

    // Fase 2: Inyectar variables dinámicas del tenant {{variable}}
    resolved = resolved.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        return vars[key] ?? `[${key}]`;
    });

    return resolved;
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
    const matches = template.match(/\{([^}]+)\}/g);
    if (!matches) return 1;
    return matches.reduce((acc, match) => {
        const options = match.slice(1, -1).split('|');
        return acc * options.length;
    }, 1);
}
