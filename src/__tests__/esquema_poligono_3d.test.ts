import { describe, it, expect } from 'vitest';
import {
    ARCHITECTURE_LAYERS,
    INTER_LAYER_PIPES,
    SOFTWARE_FLOWS
} from '@/lib/architecture-3d/schemaPoligonoTypes';
import type { PolygonNode } from '@/lib/architecture-3d/schemaPoligonoTypes';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEST SUITE: ESQUEMA POLIGONAL 3D — ARQUITECTURA POR CAPAS & FONTANERÍA N3
 * ═══════════════════════════════════════════════════════════════════════════
 * Valida la topología circulatoria del sistema por capas 3D, la integridad de
 * tuberías entre planos isométricos y la consistencia matemática de los flujos.
 */

describe('Esquema Poligonal 3D — Integridad de Capas Isométricas', () => {

    it('debe contener exactamente 5 capas jerárquicas estratificadas (0 a 4)', () => {
        expect(ARCHITECTURE_LAYERS).toHaveLength(5);
        ARCHITECTURE_LAYERS.forEach((layer, idx) => {
            expect(layer.index).toBe(idx);
            expect(layer.name).toBeDefined();
            expect(layer.nodes.length).toBeGreaterThan(0);
            expect(layer.color).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(layer.wireframeColor).toContain('rgba');
        });
    });

    it('cada capa debe pertenecer a una taxonomía sistémica de fontanería válida', () => {
        const expectedCategories = ['RAICES', 'ARTERIAS', 'COMPUERTAS', 'CORAZON', 'SALIDAS'];
        ARCHITECTURE_LAYERS.forEach((layer, idx) => {
            expect(layer.category).toBe(expectedCategories[idx]);
        });
    });

    it('cada nodo poligonal debe tener coordenadas normalizadas y forma geométrica válida', () => {
        const validShapes = ['hexagon', 'diamond', 'shield', 'octagon', 'square'];
        const allNodes: PolygonNode[] = ARCHITECTURE_LAYERS.flatMap(l => l.nodes);

        allNodes.forEach(node => {
            expect(node.id).toBeDefined();
            expect(node.name.length).toBeGreaterThan(3);
            expect(validShapes).toContain(node.polygonShape);
            // Coordenadas dentro del plano isométrico [-2.5, 2.5]
            expect(node.x).toBeGreaterThanOrEqual(-2.5);
            expect(node.x).toBeLessThanOrEqual(2.5);
            expect(node.y).toBeGreaterThanOrEqual(-2.5);
            expect(node.y).toBeLessThanOrEqual(2.5);
            expect(node.status).toBe('IMPLEMENTADO');
        });
    });

    it('cada nodo poligonal debe cumplir el Cuestionario de Fontanería Sistémica N3 (8 compuertas)', () => {
        const allNodes: PolygonNode[] = ARCHITECTURE_LAYERS.flatMap(l => l.nodes);

        allNodes.forEach(node => {
            const p = node.plumbing;
            expect(p).toBeDefined();
            expect(p.queAccionOcurre.length).toBeGreaterThan(10);
            expect(p.deQueDatoDepende.length).toBeGreaterThan(10);
            expect(p.caminoExitoYRechazo.length).toBeGreaterThan(10);
            expect(p.mutacionDatos.length).toBeGreaterThan(10);
            expect(p.partesAfectadas.length).toBeGreaterThan(10);
            expect(p.quienRecibeResultado.length).toBeGreaterThan(5);
            expect(p.queFallaEnCorteRed.length).toBeGreaterThan(10);
            expect(p.recuperacionIdempotencia.length).toBeGreaterThan(10);
        });
    });
});

describe('Esquema Poligonal 3D — Tuberías y Arterias Inter-Capa', () => {

    it('todas las tuberías deben conectar nodos reales existentes sin enlaces huérfanos', () => {
        const nodeMap = new Map<string, PolygonNode>();
        ARCHITECTURE_LAYERS.forEach(l => l.nodes.forEach(n => nodeMap.set(n.id, n)));

        expect(INTER_LAYER_PIPES.length).toBeGreaterThanOrEqual(10);

        INTER_LAYER_PIPES.forEach(pipe => {
            expect(nodeMap.has(pipe.fromNodeId)).toBe(true);
            expect(nodeMap.has(pipe.toNodeId)).toBe(true);
            expect(pipe.latencyMs).toBeGreaterThan(0);
            expect(['HTTP_JSON', 'SOCKET_IO', 'SQLITE_WAL', 'PRISMA', 'ESC_POS', 'WEBRTC']).toContain(pipe.protocol);
        });
    });

    it('el flujo descendente debe respetar la jerarquía de capas (causalidad de arriba hacia abajo)', () => {
        const nodeMap = new Map<string, PolygonNode>();
        ARCHITECTURE_LAYERS.forEach(l => l.nodes.forEach(n => nodeMap.set(n.id, n)));

        // Verificar que las tuberías principales conectan capas adyacentes o de la misma capa
        INTER_LAYER_PIPES.forEach(pipe => {
            const fromNode = nodeMap.get(pipe.fromNodeId)!;
            const toNode = nodeMap.get(pipe.toNodeId)!;
            // No debe haber saltos invertidos ilógicos (ej. de Salidas a Raíces sin mediación)
            const layerDiff = toNode.layerIndex - fromNode.layerIndex;
            expect(layerDiff).toBeGreaterThanOrEqual(0); // Mismo nivel o hacia capas más profundas
        });
    });
});

describe('Esquema Poligonal 3D — Flujos de Software Simulados', () => {

    it('debe definir los 3 flujos clave: Venta Mostrador, Delivery Geocerca y Radio LAN', () => {
        expect(SOFTWARE_FLOWS).toHaveLength(3);
        const flowIds = SOFTWARE_FLOWS.map(f => f.id);
        expect(flowIds).toContain('flujo_venta_caja');
        expect(flowIds).toContain('flujo_delivery_geofence');
        expect(flowIds).toContain('flujo_offline_radio');
    });

    it('cada flujo debe atravesar nodos válidos en pasos ordenados secuencialmente', () => {
        const allNodeIds = new Set(ARCHITECTURE_LAYERS.flatMap(l => l.nodes.map(n => n.id)));

        SOFTWARE_FLOWS.forEach(flow => {
            expect(flow.steps.length).toBeGreaterThanOrEqual(4);
            flow.steps.forEach((step, idx) => {
                expect(step.stepIndex).toBe(idx + 1);
                expect(allNodeIds.has(step.nodeId)).toBe(true);
                expect(step.durationMs).toBeGreaterThan(0);
                expect(step.actionLabel.length).toBeGreaterThan(5);
            });
        });
    });
});

describe('Esquema Poligonal — Algoritmo de Geometría y Punto en Polígono (Raycasting)', () => {

    // Algoritmo matemático Raycasting estándar para verificar si un punto GPS [lat, lng]
    // cae dentro de un polígono cerrado sin depender de librerías externas o APIs de pago
    function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
        const [x, y] = point;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Polígono de prueba hexagonal (área de cobertura de tienda)
    const testPolygon: [number, number][] = [
        [19.4326, -99.1332],
        [19.4400, -99.1200],
        [19.4500, -99.1250],
        [19.4550, -99.1400],
        [19.4450, -99.1500],
        [19.4350, -99.1450],
        [19.4326, -99.1332] // Cierre del polígono
    ];

    it('debe validar que el polígono está geométricamente cerrado (primer y último vértice coinciden)', () => {
        const first = testPolygon[0];
        const last = testPolygon[testPolygon.length - 1];
        expect(first[0]).toBe(last[0]);
        expect(first[1]).toBe(last[1]);
    });

    it('debe detectar correctamente si una coordenada está DENTRO del polígono (Envío Gratis / Válido)', () => {
        // Centro aproximado del polígono
        const insidePoint: [number, number] = [19.4420, -99.1350];
        expect(isPointInPolygon(insidePoint, testPolygon)).toBe(true);
    });

    it('debe rechazar correctamente coordenadas FUERA del polígono (Fuera de Cobertura)', () => {
        // Coordenada lejana fuera de la geocerca
        const outsidePoint: [number, number] = [19.5000, -99.2000];
        expect(isPointInPolygon(outsidePoint, testPolygon)).toBe(false);
    });
});
