import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface LicenseInfo {
    hwid: string;
    installDate: number; // timestamp
    trialEndDate: number; // timestamp
    subscriptionEndDate: number | null; // timestamp
    isTrial: boolean;
    isActive: boolean;
    daysRemaining: number;
}

// TODO: In a real desktop app, we would get CPU/Motherboard serials. 
// For Next.js/Node, we create a stable unique ID based on network interfaces and OS info,
// or we generate a UUID and lock it heavily in the filesystem/sqlite.
export function generateHWID(): string {
    const interfaces = os.networkInterfaces();
    let macAddress = '';
    for (const key in interfaces) {
        const netInterface = interfaces[key];
        if (netInterface) {
            for (const details of netInterface) {
                if (!details.internal && details.mac !== '00:00:00:00:00:00') {
                    macAddress = details.mac;
                    break;
                }
            }
        }
        if (macAddress) break;
    }
    
    const cpuInfo = os.cpus()[0]?.model || 'unknown_cpu';
    const rawHwid = `${os.platform()}-${macAddress}-${cpuInfo}`;
    
    return crypto.createHash('sha256').update(rawHwid).digest('hex').substring(0, 32);
}

// Ruta secreta donde guardamos la licencia cifrada localmente
const LICENSE_PATH = path.join(process.cwd(), '.bunkker_lic');
const SECRET_KEY = 'BUNKKER-DRM-2026-SUPER-SECRET-KEY'; // En producción, ofuscar.

function encryptData(text: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SECRET_KEY.padEnd(32, '0')), Buffer.alloc(16, 0));
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptData(encrypted: string): string {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY.padEnd(32, '0')), Buffer.alloc(16, 0));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

export function initializeLicense(): LicenseInfo {
    const currentHwid = generateHWID();
    const now = Date.now();

    if (!fs.existsSync(LICENSE_PATH)) {
        // Primer arranque: Crear Trial de 15 días
        const trialMs = 15 * 24 * 60 * 60 * 1000;
        const newLicense = {
            hwid: currentHwid,
            installDate: now,
            trialEndDate: now + trialMs,
            subscriptionEndDate: null
        };

        fs.writeFileSync(LICENSE_PATH, encryptData(JSON.stringify(newLicense)));
        return getLicenseStatus();
    }

    return getLicenseStatus();
}

export function getLicenseStatus(): LicenseInfo {
    if (!fs.existsSync(LICENSE_PATH)) {
        return initializeLicense(); // Si borraron el archivo, se reinicia? NO, idealmente la BD SQLite también debe checar esto.
    }

    try {
        const encrypted = fs.readFileSync(LICENSE_PATH, 'utf8');
        const data = JSON.parse(decryptData(encrypted));
        const currentHwid = generateHWID();

        // 1. Validar Anti-Clonación (HWID mismatch)
        if (data.hwid !== currentHwid) {
            console.error("⛔ [DRM ALERTA] Hardware ID no coincide. Posible clonación detectada.");
            return {
                hwid: currentHwid,
                installDate: data.installDate,
                trialEndDate: data.trialEndDate,
                subscriptionEndDate: data.subscriptionEndDate,
                isTrial: false,
                isActive: false, // Bloqueo automático
                daysRemaining: 0
            };
        }

        const now = Date.now();
        let isActive = false;
        let isTrial = false;
        let daysRemaining = 0;

        // 2. Revisar si tiene suscripción activa
        if (data.subscriptionEndDate && data.subscriptionEndDate > now) {
            isActive = true;
            daysRemaining = Math.ceil((data.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
        } 
        // 3. Revisar si está en Trial
        else if (data.trialEndDate > now) {
            isActive = true;
            isTrial = true;
            daysRemaining = Math.ceil((data.trialEndDate - now) / (1000 * 60 * 60 * 24));
        }

        return {
            hwid: currentHwid,
            installDate: data.installDate,
            trialEndDate: data.trialEndDate,
            subscriptionEndDate: data.subscriptionEndDate,
            isTrial,
            isActive,
            daysRemaining
        };

    } catch (err) {
        // Si manipularon el archivo y no se puede desencriptar
        return {
            hwid: generateHWID(),
            installDate: 0,
            trialEndDate: 0,
            subscriptionEndDate: null,
            isTrial: false,
            isActive: false,
            daysRemaining: 0
        };
    }
}

// Simular el Webhook de Stripe (En producción, esto lo llama tu API cuando reciben pago)
export function extendSubscription(days: number = 30) {
    if (!fs.existsSync(LICENSE_PATH)) return;

    try {
        const encrypted = fs.readFileSync(LICENSE_PATH, 'utf8');
        const data = JSON.parse(decryptData(encrypted));
        
        const now = Date.now();
        const extensionMs = days * 24 * 60 * 60 * 1000;

        // Si ya tenía suscripción activa, le sumamos a su fecha. Si no, a partir de hoy.
        const currentEnd = (data.subscriptionEndDate && data.subscriptionEndDate > now) ? data.subscriptionEndDate : now;
        data.subscriptionEndDate = currentEnd + extensionMs;

        fs.writeFileSync(LICENSE_PATH, encryptData(JSON.stringify(data)));
        console.log(`✅ [DRM] Suscripción extendida por ${days} días.`);
    } catch (err) {
        console.error("Error extendiendo suscripción:", err);
    }
}
