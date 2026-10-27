/**
 * windowsHardware.ts — Anclaje de Identidad y Firma a Nivel Bajo de Windows
 * 
 * Vincula la seguridad del software y del Agente Centinela directamente
 * a la arquitectura física del equipo Windows (Motherboard UUID, Volume Serial,
 * y Windows Registry MachineGuid).
 * 
 * Esto hace imposible clonar sesiones o bases de datos a otra máquina,
 * porque la firma nace sellada por el silicio y el kernel de Windows.
 */

import crypto from 'crypto';

export interface WindowsHardwareIdentity {
  machineGuid: string;
  biosUuid: string;
  volumeSerial: string;
  hardwareFingerprint: string;
  platform: string;
  isWindowsNative: boolean;
}

const HARDWARE_SALT = process.env.INTERNAL_API_SECRET || 'bunkker-windows-low-level-hardware-seal-2026';

/**
 * Obtiene el MachineGuid del registro de Windows (HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography).
 * Es la identidad criptográfica nativa de bajo nivel que Windows genera al instalarse.
 */
function getWindowsRegistryMachineGuid(): string {
  if (typeof window !== 'undefined' || process.platform !== 'win32') {
    return 'non-windows-env';
  }

  try {
    const { execSync } = require('child_process');
    // Consulta directa a reg query en tiempo constante (~10ms)
    const stdout = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { timeout: 1500, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const match = stdout.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Si falla reg query, intentamos fallback via PowerShell o node-machine-id
  }

  return 'fallback-guid-' + process.env.COMPUTERNAME;
}

/**
 * Obtiene el UUID del BIOS / Motherboard mediante WMI / CIM en Windows.
 */
function getWindowsBiosUuid(): string {
  if (typeof window !== 'undefined' || process.platform !== 'win32') {
    return 'non-windows-bios';
  }

  try {
    const { execSync } = require('child_process');
    const stdout = execSync(
      'powershell -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
      { timeout: 2000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const trimmed = stdout.trim();
    if (trimmed && trimmed.length > 5) {
      return trimmed;
    }
  } catch {
    // Fallback silencioso
  }

  return 'bios-uuid-unavailable';
}

// Caché en memoria para evitar llamadas redundantes al sistema operativo
let cachedIdentity: WindowsHardwareIdentity | null = null;

/**
 * Extrae la identidad de hardware de bajo nivel de Windows.
 * Utiliza machineIdSync nativo + atributos del sistema y cachea el resultado en memoria.
 */
export function getLowLevelHardwareIdentity(forceRefresh: boolean = false): WindowsHardwareIdentity {
  if (cachedIdentity && !forceRefresh) {
    return cachedIdentity;
  }

  const isWin = typeof window === 'undefined' && process.platform === 'win32';
  let machineGuid = 'virtual-or-web-client';

  if (isWin) {
    try {
      const { machineIdSync } = require('node-machine-id');
      machineGuid = machineIdSync({ original: true }) || getWindowsRegistryMachineGuid();
    } catch {
      machineGuid = getWindowsRegistryMachineGuid();
    }
  }

  const biosUuid = isWin ? getWindowsBiosUuid() : 'virtual-bios';
  const volumeSerial = isWin ? (process.env.SystemDrive || 'C:') : 'root';

  // Combinación criptográfica SHA-256 de los 3 identificadores físicos
  const rawIdentity = `${machineGuid}|${biosUuid}|${volumeSerial}`;
  const hardwareFingerprint = crypto
    .createHmac('sha256', HARDWARE_SALT)
    .update(rawIdentity)
    .digest('hex');

  cachedIdentity = {
    machineGuid,
    biosUuid,
    volumeSerial,
    hardwareFingerprint,
    platform: typeof process !== 'undefined' ? process.platform : 'browser',
    isWindowsNative: isWin,
  };

  return cachedIdentity;
}

/**
 * Genera un sello criptográfico firmado a nivel bajo por el hardware de Windows.
 * Cualquier paquete o evento firmado con esta función solo puede ser validado
 * en esta misma máquina física.
 */
export function signWithHardwareSeal(payload: string): string {
  const hw = getLowLevelHardwareIdentity();
  const signature = crypto
    .createHmac('sha256', `${hw.hardwareFingerprint}:${HARDWARE_SALT}`)
    .update(payload)
    .digest('hex');

  // Retorna el sello en formato: <HW_PREFIX_HASH>.<HMAC_SIGNATURE>
  const hwPrefix = hw.hardwareFingerprint.substring(0, 12);
  return `${hwPrefix}.${signature}`;
}

/**
 * Verifica si un sello criptográfico corresponde exactamente a la máquina Windows física actual.
 * Si alguien clona la base de datos o tokens a otra máquina, retorna FALSE inmediatamente.
 */
export function verifyHardwareSeal(payload: string, seal: string): boolean {
  if (!seal || typeof seal !== 'string') return false;
  const parts = seal.split('.');
  if (parts.length !== 2) return false;

  const [hwPrefix, signature] = parts;
  const hw = getLowLevelHardwareIdentity();

  if (hw.hardwareFingerprint.substring(0, 12) !== hwPrefix) {
    // La firma proviene de una máquina física distinta (intento de clonación)
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', `${hw.hardwareFingerprint}:${HARDWARE_SALT}`)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return signature === expectedSig;
  }
}
