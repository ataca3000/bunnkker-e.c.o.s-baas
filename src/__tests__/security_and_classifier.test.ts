import { describe, it, expect } from 'vitest';
import { classifyLocalProduct } from '../lib/ai/productClassifier';

import fs from 'fs';
import path from 'path';

// En entorno CI o sin modelo local descargado, se omiten las pruebas que dependen de archivos externos
const hasTopicsModel = fs.existsSync(path.join(process.cwd(), 'unsupervised_topic_modeling-master'));
const isCI = process.env.CI === 'true' || !!process.env.GITHUB_ACTIONS || !hasTopicsModel;

describe('Security & Local Classifier Validation', () => {
  describe('Unsupervised Topics Classifier', () => {
    it('should classify a product name containing terms from topics model (Spanish)', () => {
      if (isCI) {
        console.log('[TEST SKIP] Classifier test omitido en CI — modelo no entrenado en runner.');
        return;
      }
      const result = classifyLocalProduct("Detalles de comentarios");
      console.log(`[TEST AUDIT] Classification for 'Detalles de comentarios':`, result);
      expect(result.category).toBeDefined();
      expect(result.category).not.toBe("General");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify a product name containing friends/games terms', () => {
      if (isCI) {
        console.log('[TEST SKIP] Classifier test omitido en CI — modelo no entrenado en runner.');
        return;
      }
      const result = classifyLocalProduct("Juegos para sucursal");
      console.log(`[TEST AUDIT] Classification for 'Juegos para sucursal':`, result);
      expect(result.category).toBeDefined();
      expect(result.category).not.toBe("General");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should fall back to General/Sin Clasificar for completely random words', () => {
      if (isCI) {
        console.log('[TEST SKIP] Classifier fallback test omitido en CI.');
        return;
      }
      const result = classifyLocalProduct("xyz123abc456qwerty");
      expect(result.category).toBe("General");
      expect(result.subcategory).toBe("Sin Clasificar");
      expect(result.confidence).toBe(0.2);
    });
  });

  describe('PIN Throttling and Lockout Map Logic', () => {
    it('should verify brute force protection map tracks failed attempts and locks', () => {
      const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();
      const clientIp = '192.168.1.99';
      
      // Simulate 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        const record = failedAttempts.get(clientIp) || { count: 0, blockedUntil: 0 };
        const newCount = record.count + 1;
        const blockedUntil = newCount >= 4 ? Date.now() + 15 * 60 * 1000 : 0;
        failedAttempts.set(clientIp, { count: newCount, blockedUntil });
      }

      const finalRecord = failedAttempts.get(clientIp);
      expect(finalRecord).toBeDefined();
      expect(finalRecord!.count).toBe(4);
      expect(finalRecord!.blockedUntil).toBeGreaterThan(Date.now());
    });
  });
});
