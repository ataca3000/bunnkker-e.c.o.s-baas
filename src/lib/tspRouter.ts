/**
 * Motor de Enrutamiento Inteligente Offline (TSP)
 * Calcula la distancia utilizando la fórmula Haversine (línea recta sobre la esfera terrestre).
 * Optimiza la ruta utilizando Vecino Más Cercano (Nearest Neighbor) + Optimización 2-Opt.
 */

interface Point {
    id: string;
    lat: number;
    lng: number;
}

// Distancia en metros entre dos coordenadas (Haversine)
function getDistance(p1: Point, p2: Point): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calcula la distancia total de una ruta
function calculateTotalDistance(route: Point[]): number {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        total += getDistance(route[i], route[i + 1]);
    }
    return total;
}

/**
 * Optimiza la ruta de entrega partiendo y regresando a la bodega.
 * @param warehouse Ubicación de la bodega
 * @param deliveries Lista de puntos de entrega
 * @returns Array de índices originales optimizados
 */
export function optimizeRoute(warehouse: Omit<Point, 'id'>, deliveries: Point[]): number[] {
    if (deliveries.length === 0) return [];
    if (deliveries.length === 1) return [0];

    const start: Point = { id: 'WH', lat: warehouse.lat, lng: warehouse.lng };
    
    // 1. Fase de Construcción: Vecino más cercano (Greedy)
    let unvisited = deliveries.map((d, index) => ({ ...d, originalIndex: index }));
    let current = start;
    let route = [];
    
    while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < unvisited.length; i++) {
            const dist = getDistance(current, unvisited[i]);
            if (dist < minDistance) {
                minDistance = dist;
                nearestIdx = i;
            }
        }
        
        const nextPoint = unvisited[nearestIdx];
        route.push(nextPoint);
        current = nextPoint;
        unvisited.splice(nearestIdx, 1);
    }
    
    // 2. Fase de Mejora: Algoritmo 2-Opt (Deshace cruces de líneas)
    let improved = true;
    let bestRoute = [start, ...route, start]; // Ruta completa incluyendo regreso a bodega
    
    while (improved) {
        improved = false;
        for (let i = 1; i < bestRoute.length - 2; i++) {
            for (let k = i + 1; k < bestRoute.length - 1; k++) {
                const p1 = bestRoute[i - 1];
                const p2 = bestRoute[i];
                const p3 = bestRoute[k];
                const p4 = bestRoute[k + 1];

                const currentDist = getDistance(p1, p2) + getDistance(p3, p4);
                const newDist = getDistance(p1, p3) + getDistance(p2, p4);

                if (newDist < currentDist) {
                    // Reversa el segmento entre i y k
                    const reversedSegment = bestRoute.slice(i, k + 1).reverse();
                    bestRoute.splice(i, k - i + 1, ...reversedSegment);
                    improved = true;
                }
            }
        }
    }
    
    // Extraer solo los índices de las entregas (sin la bodega)
    const optimizedIndices: number[] = [];
    for (let i = 1; i < bestRoute.length - 1; i++) {
        const point = bestRoute[i] as any; // any para acceder a originalIndex
        optimizedIndices.push(point.originalIndex);
    }

    return optimizedIndices;
}
