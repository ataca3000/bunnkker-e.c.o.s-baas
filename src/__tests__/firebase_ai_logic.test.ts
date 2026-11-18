import { describe, expect, it, vi } from 'vitest';
import { InferenceMode } from 'firebase/ai';
import {
  buildBunkkerRoleSystemInstruction,
  buildHybridModelParams,
  DEFAULT_FIREBASE_CLOUD_MODEL,
  detectFirebaseAiCapabilities,
  runHybridFirebaseInference,
} from '@/lib/firebaseAiLogic';

describe('Firebase AI Logic Hybrid Engine', () => {
  it('configura PREFER_ON_DEVICE con initialPrompts tipados y fallback cloud', () => {
    const params = buildHybridModelParams({
      systemInstruction: 'Asistente operativo BUNKKER',
    });

    expect(params.mode).toBe(InferenceMode.PREFER_ON_DEVICE);
    expect(params.inCloudParams?.model).toBe(DEFAULT_FIREBASE_CLOUD_MODEL);
    expect(params.inCloudParams?.systemInstruction).toBe('Asistente operativo BUNKKER');
    expect(params.onDeviceParams?.createOptions?.initialPrompts).toEqual([
      {
        role: 'system',
        content: [{ type: 'text', value: 'Asistente operativo BUNKKER' }],
      },
    ]);
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

  it('detecta capacidades en entorno Node/SSR sin fallar', () => {
    const caps = detectFirebaseAiCapabilities();
    expect(caps.preferredMode).toBe(InferenceMode.PREFER_ON_DEVICE);
    expect(typeof caps.hasFirebaseCredentials).toBe('boolean');
    expect(typeof caps.hasOnDevicePromptApi).toBe('boolean');
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
});
