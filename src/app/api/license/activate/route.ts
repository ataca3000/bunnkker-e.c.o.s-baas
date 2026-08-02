import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
    try {
        const { licenseKey, machineId } = await req.json();

        if (!licenseKey || !machineId) {
            return NextResponse.json({ success: false, error: 'licenseKey y machineId son requeridos' }, { status: 400 });
        }

        const docRef = adminDb.collection('licenses').doc(licenseKey);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ success: false, error: 'Licencia no encontrada' }, { status: 400 });
        }

        const licenseData = docSnap.data();

        if (!licenseData.isActive) {
            return NextResponse.json({ success: false, error: 'Licencia inactiva' }, { status: 400 });
        }

        if (licenseData.expiresAt && licenseData.expiresAt < Date.now()) {
            return NextResponse.json({ success: false, error: 'Licencia expirada' }, { status: 400 });
        }

        let machineIds = licenseData.machineIds || [];
        
        if (!machineIds.includes(machineId)) {
            if (machineIds.length >= (licenseData.maxMachines || 1)) {
                return NextResponse.json({ success: false, error: 'Límite de máquinas alcanzado' }, { status: 400 });
            }
            machineIds.push(machineId);
            await docRef.update({ machineIds });
        }

        // Save activation result to local file
        const sysDir = path.join(os.homedir(), '.admincom_sys');
        if (!fs.existsSync(sysDir)) {
            fs.mkdirSync(sysDir, { recursive: true });
        }
        
        const cacheFile = path.join(sysDir, 'license_cache.json');
        const cacheData = {
            licenseKey,
            machineId,
            tier: 'pro',
            lastChecked: Date.now()
        };
        fs.writeFileSync(cacheFile, JSON.stringify(cacheData));

        return NextResponse.json({ 
            success: true, 
            tier: 'pro', 
            clientName: licenseData.clientName, 
            expiresAt: licenseData.expiresAt 
        });
    } catch (err) {
        console.error('[API/license/activate POST]', err);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
