import { describe, expect, it, vi } from 'vitest';
import { InferenceMode } from 'firebase/ai';
import {
  buildBunkkerRoleSystemInstruction,
  buildHybridModelParams,
  DEFAULT_FIREBASE_CLOUD_MODEL,
  detectFirebaseAiCapabilities,
  getHybridExecutionHistory,
  probeFirebaseAiDiagnostics,
  runHybridFirebaseInference,
  runHybridOperationalSummary,
  runHybridProductClassification,
} from '@/lib/firebaseAiLogic';

describe('Firebase AI Logic Hybrid Engine', () => {
  it('configura PREFER_ON_DEVICE y PREFER_IN_CLOUD con initialPrompts tipados y fallback cloud', () => {
    const onDeviceFirst = buildHybridModelParams({
      systemInstruction: 'Asistente operativo BUNKKER',
      mode: InferenceMode.PREFER_ON_DEVICE,
    });

    expect(onDeviceFirst.mode).toBe(InferenceMode.PREFER_ON_DEVICE);
    expect(onDeviceFirst.inCloudParams?.model).toBe(DEFAULT_FIREBASE_CLOUD_MODEL);
    expect(onDeviceFirst.inCloudParams?.systemInstruction).toBe('Asistente operativo BUNKKER');
    expect(onDeviceFirst.onDeviceParams?.createOptions?.initialPrompts).toEqual([
      {
        role: 'system',
        content: [{ type: 'text', value: 'Asistente operativo BUNKKER' }],
      },
    ]);

    const cloudFirst = buildHybridModelParams({
      systemInstruction: 'Auditoría extensa',
      mode: InferenceMode.PREFER_IN_CLOUD,
    });
    expect(cloudFirst.mode).toBe(InferenceMode.PREFER_IN_CLOUD);
  });

  it('construye instrucciones de rol acotadas y sin filtrar secretos', () => {
    const instruction = buildBunkkerRoleSystemInstruction('inventory', {
      businessName: 'Ferretería Norte',
      ordersCount: 14,
      products: Array.from({ length: 20 }, (_, i) => ({
        name: `Producto ${i + 1}`,
        stock: i,
        price: 100 + i,
        location: `A-${i + 1}`,
      })),
    });

    expect(instruction).toContain('Ferretería Norte');
    expect(instruction).toContain('(inventory)');
    expect(instruction).toContain('"totalProductsInContext":20');
    expect(instruction).not.toContain('Producto 15');
    expect(instruction).not.toContain('GEMINI_API_KEY');
  });

  it('detecta capacidades y ejecuta diagnóstico estructurado en entorno Node/SSR sin fallar', async () => {
    const caps = detectFirebaseAiCapabilities();
    expect(caps.preferredMode).toBe(InferenceMode.PREFER_ON_DEVICE);
    expect(typeof caps.hasFirebaseCredentials).toBe('boolean');
    expect(typeof caps.hasOnDevicePromptApi).toBe('boolean');

    const report = await probeFirebaseAiDiagnostics();
    expect(report.cloudModel).toBe(DEFAULT_FIREBASE_CLOUD_MODEL);
    expect(report.supportedModes).toContain(InferenceMode.PREFER_ON_DEVICE);
    expect(report.supportedModes).toContain(InferenceMode.PREFER_IN_CLOUD);
    expect(report.onDeviceAvailability).toBe('unsupported');
  });

  it('resuelve via fallback de servidor Gemini y luego motor local offline si falla la red', async () => {
    const serverFetcher = vi.fn().mockResolvedValue({
      reply: 'El stock de Taladro es 24 pzas.',
      engine: 'gemini-4-hydrogen',
    });

    const serverResult = await runHybridFirebaseInference({
      prompt: '¿Cuánto stock hay del taladro?',
      role: 'sales',
      contextData: {
        businessName: 'Ferretería Central',
        products: [{ name: 'Taladro Percutor', stock: 24, price: 1850 }],
      },
      serverFallbackFetcher: serverFetcher,
    });

    expect(['on_device', 'in_cloud', 'server_gemini']).toContain(serverResult.source);
    expect(serverResult.text.length).toBeGreaterThan(0);

    const offlineResult = await runHybridFirebaseInference({
      prompt: 'muestra alertas de stock bajo',
      role: 'superadmin',
      contextData: {
        businessName: 'Ferretería Central',
        products: [
          { name: 'Kit Grifería', stock: 2, price: 680 },
          { name: 'Cemento 50kg', stock: 80, price: 245 },
        ],
      },
      serverFallbackFetcher: async () => {
        throw new Error('offline');
      },
    });

    expect(offlineResult.source).toBe('local_rule_engine');
    expect(offlineResult.text).toContain('Kit Grifería');
    expect(offlineResult.text).toContain('2 pzas');
  });

  it('enruta resúmenes cortos con PREFER_ON_DEVICE y auditorías extensas con PREFER_IN_CLOUD', async () => {
    const shortBrief = await runHybridOperationalSummary({
      scope: 'inventory_brief',
      businessName: 'Ferretería Sur',
      products: [
        { name: 'Cemento Gris 50kg', stock: 3, price: 245 },
        { name: 'Varilla 3/8', stock: 40, price: 180 },
      ],
      orders: [{ id: 'ORD-1', total: 490, status: 'paid' }],
      auditCount: 5,
    });

    expect(shortBrief.requestedMode).toBe(InferenceMode.PREFER_ON_DEVICE);
    expect(shortBrief.text.length).toBeGreaterThan(20);

    const deepAudit = await runHybridOperationalSummary({
      scope: 'audit_deep',
      businessName: 'Ferretería Sur',
      products: [{ name: 'Cemento Gris 50kg', stock: 3, price: 245 }],
      orders: [{ id: 'ORD-1', total: 490, status: 'paid' }],
      auditCount: 80,
    });

    expect(deepAudit.requestedMode).toBe(InferenceMode.PREFER_IN_CLOUD);
    expect(deepAudit.text.length).toBeGreaterThan(20);

    const history = getHybridExecutionHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('autoclasifica productos ferreteros con respaldo determinístico y trazabilidad de motor', async () => {
    const classified = await runHybridProductClassification('Cemento Portland Cruz Azul 50kg');
    expect(classified.category).toBe('Materiales de Construcción');
    expect(['on_device', 'in_cloud', 'server_gemini', 'local_rule_engine']).toContain(
      classified.source
    );
    expect(classified.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
