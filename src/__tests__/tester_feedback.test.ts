import { describe, expect, it } from 'vitest';
import {
  buildSupportTicketPayload,
  shouldConnectLocalLanSocket,
  validateFeedbackInput,
} from '../lib/testerFeedback';

describe('testerFeedback helpers', () => {
  it('validates feedback length and optional email format', () => {
    expect(validateFeedbackInput({ category: 'bug', message: 'ok' }).valid).toBe(false);
    expect(
      validateFeedbackInput({
        category: 'bug',
        message: 'La cámara tardó en enfocar en inventario',
        contactEmail: 'correo-invalido',
      }).valid
    ).toBe(false);
    expect(
      validateFeedbackInput({
        category: 'bug',
        message: 'La cámara tardó en enfocar en inventario',
        contactEmail: 'tester@empresa.com',
      }).valid
    ).toBe(true);
  });

  it('formats support ticket payloads under 2500 characters with metadata', () => {
    const payload = buildSupportTicketPayload({
      category: 'account_deletion',
      message: 'Solicito eliminar mi cuenta de pruebas.',
      contactEmail: 'usuario@ejemplo.com',
      reporterName: 'Luis',
      route: '/privacidad',
    });

    expect(payload.folio.startsWith('DEL-')).toBe(true);
    expect(payload.customerEmail).toBe('usuario@ejemplo.com');
    expect(payload.message).toContain('[TIPO: ELIMINACION-CUENTA]');
    expect(payload.message.length).toBeLessThanOrEqual(2400);
  });

  it('prevents mixed-content LAN socket connections on public HTTPS mobile hosts', () => {
    expect(
      shouldConnectLocalLanSocket(
        'ais-dev-example.us-east1.run.app',
        'https:'
      )
    ).toBe(false);

    expect(
      shouldConnectLocalLanSocket(
        'ais-dev-example.us-east1.run.app',
        'https:',
        'https://radio.miempresa.local'
      )
    ).toBe(true);

    expect(shouldConnectLocalLanSocket('192.168.1.50', 'http:')).toBe(true);
    expect(shouldConnectLocalLanSocket('localhost', 'http:')).toBe(true);
    expect(shouldConnectLocalLanSocket('miapp.vercel.app', 'http:')).toBe(false);
  });
});
