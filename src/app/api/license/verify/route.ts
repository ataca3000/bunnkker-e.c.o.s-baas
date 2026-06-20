import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
    // Obtenemos el HWID inyectado por Electron al levantar el servidor
    const hwid = process.env.MACHINE_HWID;
    
    if (!hwid) {
        return NextResponse.json({ 
            isValid: true, 
            tier: 'standard', 
            hwid: null,
            message: 'Modo Web/Estándar. No se detectó HWID físico.' 
        });
    }

    try {
        const sysDir = path.join(os.homedir(), '.admincom_sys');
        if (!fs.existsSync(sysDir)) {
            fs.mkdirSync(sysDir, { recursive: true });
        }
        
        const licenseFile = path.join(sysDir, `license_${hwid}.json`);
        let trialData;

        if (fs.existsSync(licenseFile)) {
            trialData = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        } else {
            trialData = {
                hwid,
                installDate: Date.now(),
                trialDays: 15,
                status: 'active'
            };
            fs.writeFileSync(licenseFile, JSON.stringify(trialData));
        }

        const daysPassed = (Date.now() - trialData.installDate) / (1000 * 60 * 60 * 24);
        const remainingDays = Math.max(0, Math.ceil(trialData.trialDays - daysPassed));
        const isTrialActive = remainingDays > 0;
        
        // Simulación: Si hay internet, podríamos ir a adminDb de Firebase a ver si ya la compró.
        // Si no la ha comprado, usamos el trial local:

        if (isTrialActive) {
            return NextResponse.json({ 
                isValid: true, 
                tier: 'pro',
                hwid: hwid,
                remainingDays,
                message: `Licencia TRIAL activa. Quedan ${remainingDays} días.` 
            });
        }

        return NextResponse.json({ 
            isValid: true, 
            tier: 'standard',
            hwid: hwid,
            remainingDays: 0,
            message: 'TRIAL expirado. Ejecutando en modo Estándar.' 
        });
    } catch (error) {
        console.error('License API Error:', error);
        return NextResponse.json({ 
            isValid: false, 
            tier: 'standard', 
            error: 'Error validando licencia en la máquina' 
        }, { status: 500 });
    }
}
