/**
 * productClassifier.ts — Re-exporta desde el motor unificado
 * @deprecated Usar engine.ts directamente para nuevas funciones
 */
export { classifyProduct, classifyLocalProduct, classifyProductText, logAIClassificationAudit, teachEngine } from './engine';
export type { ClassificationResult } from './engine';
