import type { OmniAccountSummary, DispatchResult } from './types';

// Almacén en memoria compartido para Omnipulse
export const accountStore = new Map<string, OmniAccountSummary[]>();
export const dispatchResults = new Map<string, DispatchResult[]>();
export const postStore = new Map<string, { body: string; hashtags: string; mediaUrls: string[]; useSpintax: boolean }>();
