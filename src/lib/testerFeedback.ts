export type TesterFeedbackCategory = 'bug' | 'ux' | 'suggestion' | 'account_deletion';

export interface TesterFeedbackInput {
  category: TesterFeedbackCategory;
  message: string;
  contactEmail?: string;
  reporterName?: string;
  route?: string;
  role?: string;
  deviceInfo?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const CATEGORY_LABELS: Record<TesterFeedbackCategory, string> = {
  bug: 'FALLA-TECNICA',
  ux: 'UX-MOVIL',
  suggestion: 'SUGERENCIA',
  account_deletion: 'ELIMINACION-CUENTA',
};

export function validateFeedbackInput(input: TesterFeedbackInput): ValidationResult {
  const msg = (input.message || '').trim();
  if (msg.length < 6) {
    return {
      valid: false,
      error: 'Describe brevemente el detalle (mínimo 6 caracteres).',
    };
  }
  if (msg.length > 1800) {
    return {
      valid: false,
      error: 'El mensaje es demasiado largo (máximo 1800 caracteres).',
    };
  }
  if (input.contactEmail && input.contactEmail.trim()) {
    const email = input.contactEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        valid: false,
        error: 'Ingresa un correo electrónico válido para responderte.',
      };
    }
  }
  return { valid: true };
}

export function buildSupportTicketPayload(input: TesterFeedbackInput) {
  const tag = CATEGORY_LABELS[input.category] || 'FEEDBACK';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const folio = `${input.category === 'account_deletion' ? 'DEL' : 'BETA'}-${suffix}`;

  const metadataLines = [
    `[TIPO: ${tag}]`,
    input.route ? `Ruta: ${input.route}` : null,
    input.role ? `Rol: ${input.role}` : null,
    input.deviceInfo ? `Dispositivo: ${input.deviceInfo}` : null,
  ].filter(Boolean);

  const composedMessage = `${metadataLines.join(' · ')}\n\n${input.message.trim()}`.slice(0, 2400);

  return {
    folio,
    customerEmail: input.contactEmail?.trim() || 'tester@bunkker.local',
    customerName: input.reporterName?.trim() || 'Tester Cerrado / Operador',
    message: composedMessage,
  };
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const clean = (hostname || '').trim().toLowerCase();
  if (!clean) return false;
  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '[::1]' || clean.endsWith('.local')) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  return false;
}

export function shouldConnectLocalLanSocket(
  hostname: string,
  protocol: string,
  explicitUrl?: string
): boolean {
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return true;
  }
  if ((protocol || '').toLowerCase() === 'https:') {
    return false;
  }
  return isPrivateOrLocalHostname(hostname);
}
