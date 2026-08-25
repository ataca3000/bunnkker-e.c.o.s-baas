/**
 * DOM CRYPTO HELPER (Matriz Operacional Descentralizada)
 * Implementación de la Cadena de Inmutabilidad SHA-256 H_n
 * H_n = SHA256(id_n * monto_n * timestamp_n * usuario_n * H_{n-1})
 */

import crypto from 'crypto';

let lastKnownHash: string = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis Hash

export interface DOMHashParams {
  id: string;
  total: number;
  timestamp: string | number;
  usuario?: string;
  previousHash?: string;
}

/**
 * Calcula el Hash SHA-256 concatenado para una transacción según la especificación D.O.M.
 */
export function calculateDOMHash(params: DOMHashParams): { hash: string; prevHash: string } {
  const prevHash = params.previousHash || lastKnownHash;
  const usuario = params.usuario || 'SYSTEM_LOCAL';
  const timestampStr = typeof params.timestamp === 'number' ? new Date(params.timestamp).toISOString() : params.timestamp;

  const rawData = `${params.id}:${params.total.toFixed(2)}:${timestampStr}:${usuario}:${prevHash}`;
  
  const hash = crypto.createHash('sha256').update(rawData).digest('hex');

  // Actualizar el puntero en memoria del último hash conocido
  lastKnownHash = hash;

  console.log(`🛡️ [DOM Crypto] Hash H_n generado: ${hash.substring(0, 16)}... (Prev: ${prevHash.substring(0, 8)}...)`);

  return { hash, prevHash };
}

/**
 * Retorna el último hash de la cadena contable conocido en memoria
 */
export function getLastDOMHash(): string {
  return lastKnownHash;
}

/**
 * Permite inicializar o restaurar el último hash desde la BD al arrancar la app
 */
export function setLastDOMHash(hash: string) {
  if (hash && hash.length === 64) {
    lastKnownHash = hash;
  }
}
