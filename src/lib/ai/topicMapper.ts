/**
 * topicMapper.ts — Re-exporta desde el motor unificado
 * @deprecated Usar engine.ts directamente para nuevas funciones
 */
export { resolveIntent, resolveSemanticIntent, INTENT_MAPPINGS } from './engine';
export type { IntentResult } from './engine';

export type IntentMapping = {
  intent: string;
  label: string;
  terms: string[];
  redirect: string;
};

