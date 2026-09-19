import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseConfigured } from '@/lib/prisma';
import { verifyRoleSignature, hashPinSha256 } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
    try {
        const session = req.cookies.get('msj-session')?.value;
        const role    = req.cookies.get('msj-role')?.value;
        const sig     = req.cookies.get('msj-role-sig')?.value;

        if (!session || !role || !sig) {
            return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
        }

        const valid = verifyRoleSignature(role, session, sig);
        if (!valid) {
            return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
        }

        let user: any = null;
        if (isDatabaseConfigured()) {
            try {
                user = await prisma.user.findUnique({
                    where: { id: session }
                });
            } catch (err) {
                console.warn('[USERS/ME] Error consultando usuario en base de datos:', err);
            }
        }

        // Fallback si no hay BD o el usuario no se encuentra en DB pero la sesion y firma HMAC son validos
        if (!user) {
            const DEFAULT_USERS_BY_ID: Record<string, { name: string; role: string }> = {
                'usr-superadmin': { name: 'Dueño (Superadmin)', role: 'superadmin' },
                'usr-admin': { name: 'Gerente (Admin)', role: 'admin' },
                'usr-sales': { name: 'Cajero / Ventas', role: 'sales' },
                'usr-inventory': { name: 'Bodeguero / Inventario', role: 'inventory' },
                'usr-marketing': { name: 'Diseñador / Marketing', role: 'marketing' },
                'usr-driver': { name: 'Chofer / Repartidor', role: 'driver' },
                'usr-patio': { name: 'Patio / Carga y Descarga', role: 'carga_descarga' },
                'usr-pickup': { name: 'Mostrador / Pick Up', role: 'pickup' },
                'usr-superadmin-a0': { name: 'Dueño (Superadmin)', role: 'superadmin' },
                'usr-admin-a1': { name: 'Gerente (Admin)', role: 'admin' },
                'usr-sales-a2': { name: 'Cajero / Ventas', role: 'sales' },
                'usr-inventory-a3': { name: 'Bodeguero / Inventario', role: 'inventory' },
                'usr-marketing-a4': { name: 'Diseñador / Marketing', role: 'marketing' },
                'usr-driver-a5': { name: 'Chofer / Repartidor', role: 'driver' },
                'usr-patio-a6': { name: 'Patio / Carga y Descarga', role: 'carga_descarga' },
                'usr-pickup-a7': { name: 'Mostrador / Pick Up', role: 'pickup' },
            };

            const matchedDefault = DEFAULT_USERS_BY_ID[session] || {
                name: `Usuario (${role.toUpperCase()})`,
                role: role
            };

            user = {
                id: session,
                name: matchedDefault.name,
                role: role,
                active: true
            };
        }

        if (!user || !user.active) {
            return NextResponse.json({ success: false, error: 'User not found or inactive' }, { status: 401 });
        }

        // Omitir campos sensibles de claves
        const { pin: _pin, pinHash: _pinHash, ...safeUser } = user;
        
        return NextResponse.json({ 
            success: true, 
            user: {
                ...safeUser,
                id: user.id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = req.cookies.get('msj-session')?.value;
        const role    = req.cookies.get('msj-role')?.value;
        const sig     = req.cookies.get('msj-role-sig')?.value;

        if (!session || !role || !sig) {
            return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
        }

        const valid = verifyRoleSignature(role, session, sig);
        if (!valid) {
            return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
        }

        const body = await req.json();

        if (body.action === 'CHANGE_PIN') {
            const { newPin } = body;
            const cleanPin = (newPin || '').trim();

            const letters = cleanPin.match(/[A-Za-z]/g) || [];
            const digits  = cleanPin.match(/\d/g) || [];
            
            // Requerir 5 caracteres: 1 letra y 4 números en cualquier orden
            if (cleanPin.length !== 5 || letters.length !== 1 || digits.length !== 4) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'El código de seguridad debe contener exactamente 5 caracteres (1 Letra y 4 Números en cualquier orden, ej. A1234, 1A234).' 
                }, { status: 400 });
            }

            if (isDatabaseConfigured()) {
                const pinSha = hashPinSha256(newPin);
                
                // Validar unicidad
                const existing = await prisma.user.findFirst({ 
                    where: { 
                        pin: { in: [pinSha, newPin] },
                        id: { not: session }
                    } 
                });
                if (existing) {
                    return NextResponse.json({ success: false, error: 'Este PIN ya está en uso por otra persona.' }, { status: 400 });
                }

                const pinHash = await bcrypt.hash(newPin, 10);

                await prisma.user.update({
                    where: { id: session },
                    data: {
                        pin: pinSha,
                        pinHash
                    }
                });
            }

            return NextResponse.json({ success: true, message: 'PIN actualizado' });
        }

        return NextResponse.json({ success: false, error: 'Action not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
