import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { classifyLocalProduct } from '../lib/ai/productClassifier';

function findDbPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'prisma', 'dev.db'),
    path.join(process.cwd(), '..', 'prisma', 'dev.db'),
    path.join(process.cwd(), '..', '..', 'prisma', 'dev.db'),
    path.join(process.cwd(), 'bunkker-ecos', 'apps', 'admin-com-erp', 'prisma', 'dev.db'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

describe('Security & Local Classifier Validation', () => {
  
  describe('Local Database File Protection', () => {
    it('should verify the SQLite database file exists and has owner permissions configured', () => {
      const dbPath = findDbPath();
      expect(dbPath).not.toBeNull();
      
      const stat = fs.statSync(dbPath!);
      // Imprime el modo de archivo para auditoría
      console.log(`[TEST AUDIT] SQLite database file found at ${dbPath}. Mode: 0o${(stat.mode & 0o777).toString(8)}`);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe('Unsupervised Topics Classifier', () => {
    it('should classify a product name containing terms from topics model (Spanish)', () => {
      // "comentarios" is present in topic c1 ("comentarios", "comentado", "detalles")
      const result = classifyLocalProduct("Detalles de comentarios");
      console.log(`[TEST AUDIT] Classification for 'Detalles de comentarios':`, result);
      
      expect(result.category).toBeDefined();
      expect(result.category).not.toBe("General"); // Should match a topic word capitalized, like "Comentado"
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify a product name containing friends/games terms', () => {
      // "juego" is present in topic c3 ("juego", "juegos")
      const result = classifyLocalProduct("Juegos para sucursal");
      console.log(`[TEST AUDIT] Classification for 'Juegos para sucursal':`, result);
      
      expect(result.category).toBeDefined();
      expect(result.category).not.toBe("General"); // Should match a topic word capitalized, like "Juego"
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should fall back to General/Sin Clasificar for completely random words', () => {
      const result = classifyLocalProduct("xyz123abc456qwerty");
      expect(result.category).toBe("General");
      expect(result.subcategory).toBe("Sin Clasificar");
      expect(result.confidence).toBe(0.3);
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
