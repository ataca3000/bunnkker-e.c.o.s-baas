import crypto from 'crypto';

/**
 * Motor de Sincronización a la Nube (Firebase Cloud Functions)
 * Actúa como puente entre el SQLite local y el Cloud Tenant (Versión PRO).
 */

const SYNC_URL = process.env.NEXT_PUBLIC_CLOUD_SYNC_URL || 'https://us-central1-bunkker-ecos.cloudfunctions.net/syncDataUp';

export class CloudSyncEngine {
  private machineId: string;
  private pairingSecret: string; // The 6-digit code or derived key

  constructor(machineId: string, pairingSecret: string) {
    this.machineId = machineId;
    this.pairingSecret = pairingSecret;
  }

  /**
   * Encripta el payload usando AES-256-CBC localmente antes de mandarlo a la nube.
   */
  private encryptPayload(data: any): string {
    const key = crypto.createHash('sha256').update(this.pairingSecret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Empuja las ventas locales y el estado del inventario hacia el Tenant en la nube.
   */
  public async pushToCloud(localData: any) {
    try {
      const encryptedData = this.encryptPayload(localData);
      
      const response = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            machineId: this.machineId,
            payload: encryptedData
          }
        })
      });

      const result = await response.json();
      return result.result?.success === true;
    } catch (e) {
      console.error('[CloudSyncEngine] Error sincronizando con la nube:', e);
      return false;
    }
  }
}
