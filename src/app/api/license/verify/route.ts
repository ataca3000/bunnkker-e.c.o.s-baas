import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
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
        
        const cacheFile = path.join(sysDir, 'license_cache.json');
        let localData: any = null;

        if (fs.existsSync(cacheFile)) {
            try {
                localData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            } catch (e) {
                console.error('Error parsing local cache file', e);
            }
        }

        const licenseKey = localData?.licenseKey;

        // Intentar validación online
        try {
            let licenseDoc = null;

            if (licenseKey) {
                const docSnap = await adminDb.collection('licenses').doc(licenseKey).get();
                if (docSnap.exists) {
                    licenseDoc = docSnap.data();
                }
            }
            
            if (!licenseDoc) {
                // Check by hwid in machineIds
                const snap = await adminDb.collection('licenses').where('machineIds', 'array-contains', hwid).get();
                if (!snap.empty) {
                    licenseDoc = snap.docs[0].data();
                }
            }

            if (licenseDoc) {
                // Verify status
                if (!licenseDoc.isActive) {
                    // Licencia desactivada → modo freemium, sigue funcionando
                    return NextResponse.json({ isValid: true, tier: 'standard', hwid, message: 'Licencia suspendida. Operando en modo gratuito.' });
                }
                if (licenseDoc.expiresAt && licenseDoc.expiresAt < Date.now()) {
                    // Suscripción vencida → modo freemium, sigue funcionando
                    return NextResponse.json({ isValid: true, tier: 'standard', hwid, message: 'Suscripción vencida. Operando en modo gratuito. ¡Renueva para recuperar IA y OMNIPULSE!' });
                }
                if (!licenseDoc.machineIds || !licenseDoc.machineIds.includes(hwid)) {
                    // Máquina diferente: freemium también, no bloqueamos
                    return NextResponse.json({ isValid: true, tier: 'standard', hwid, message: 'Máquina no registrada en esta licencia. Modo gratuito activo.' });
                }

                // Update local cache
                const newCache = {
                    licenseKey: licenseDoc.key,
                    machineId: hwid,
                    tier: 'pro',
                    lastChecked: Date.now()
                };
                fs.writeFileSync(cacheFile, JSON.stringify(newCache));

                return NextResponse.json({ 
                    isValid: true, 
                    tier: 'pro', 
                    hwid, 
                    message: 'Licencia válida online.' 
                });
            } else {
                // Sin licencia en Firestore → modelo freemium, tier gratuito
                return NextResponse.json({
                    isValid: true,
                    tier: 'standard',
                    hwid,
                    message: 'Modo gratuito activo. Actualiza a PRO para desbloquear IA, OMNIPULSE y backup en la nube.'
                });
            }
        } catch (onlineError) {
            console.error('Online validation failed, trying offline fallback', onlineError);
            // Fallback to offline verification
            if (localData && localData.lastChecked && localData.machineId === hwid) {
                const daysPassed = (Date.now() - localData.lastChecked) / (1000 * 60 * 60 * 24);
                if (daysPassed <= 7) {
                    return NextResponse.json({ 
                        isValid: true, 
                        tier: 'pro', 
                        hwid, 
                        remainingDays: Math.max(0, Math.ceil(7 - daysPassed)),
                        message: 'Licencia válida offline (período de gracia).' 
                    });
                } else {
                    // Gracia offline expirada → freemium, no bloqueamos
                    return NextResponse.json({ 
                        isValid: true, 
                        tier: 'standard', 
                        hwid, 
                        message: 'Modo gratuito activo. Reconecta a internet para verificar tu licencia PRO.' 
                    });
                }
            }
        }

        // Sin cache local ni Firestore → freemium funcional
        return NextResponse.json({ 
            isValid: true, 
            tier: 'standard', 
            hwid, 
            message: 'Modo gratuito activo. Actualiza a PRO para desbloquear todas las funciones.' 
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
