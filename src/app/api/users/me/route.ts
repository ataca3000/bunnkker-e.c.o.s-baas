import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRoleSignature, hashPinSha256 } from '@/lib/apiAuth';
import { INITIAL_STAFF_PIN_VALUES } from '@/lib/initialStaffPins';
import { findSessionRecord, isSessionRevoked, touchSessionRecord } from '@/lib/enterpriseControlPlane';
import { getCapabilitiesForRole } from '@/lib/enterpriseRbac';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
    try {
        const session = req.cookies.get('msj-session')?.value;
        const role    = req.cookies.get('msj-role')?.value;
        const sig     = req.cookies.get('msj-role-sig')?.value;
        const jti     = req.cookies.get('msj-jti')?.value;

        if (!session || !role || !sig) {
            return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
        }

        const valid = verifyRoleSignature(role, session, sig);
        if (!valid) {
            return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
        }

        if (jti && isSessionRevoked(jti)) {
            const res = NextResponse.json(
                { success: false, code: 'SESSION_REVOKED', error: 'Tu sesión fue revocada remotamente.' },
                { status: 401 }
            );
            res.cookies.delete('msj-session');
            res.cookies.delete('msj-role');
            res.cookies.delete('msj-role-sig');
            res.cookies.delete('msj-jti');
            return res;
        }

        const activeRec = jti ? findSessionRecord(jti) : null;
        if (jti) touchSessionRecord(jti);

        let user: any = null;
        try {
            user = await prisma.user.findUnique({
                where: { id: session }
            });
        } catch {
            user = null;
        }

        if (!user && activeRec && activeRec.provider === 'google_sso') {
            user = {
                id: activeRec.userId,
                name: activeRec.userName,
                email: activeRec.userEmail || '',
                role: activeRec.role,
                active: true,
                tenantId: activeRec.branchId,
            };
        }

        // Fallback únicamente para sesiones demo explícitas en entorno de desarrollo/test
        if (!user && session.startsWith('demo-') && process.env.NODE_ENV !== 'production') {
            const roleNameMap: Record<string, string> = {
                superadmin: 'Dueño (Superadmin)',
                admin: 'Gerente (Admin)',
                sales: 'Cajero / Ventas',
                inventory: 'Bodeguero / Inventario',
                marketing: 'Diseñador / Marketing',
                driver: 'Chofer / Repartidor',
                carga_descarga: 'Patio / Carga y Descarga',
                pickup: 'Mostrador / Pick Up'
            };
            user = {
                id: session,
                name: roleNameMap[role] || 'Usuario Staff Demo',
                role: role,
                active: true
            };
        }

        if (!user || !user.active) {
            return NextResponse.json({ success: false, error: 'User not found or inactive' }, { status: 401 });
        }

        // Omitir campos sensibles de claves
        const { pin: _pin, pinHash: _pinHash, ...safeUser } = user;
        const isInitialPin = INITIAL_STAFF_PIN_VALUES.some(initialPin => {
            const initialHash = hashPinSha256(initialPin);
            return user.pin === initialHash || user.pin === initialPin;
        });

        const capabilities = getCapabilitiesForRole(user.role);
        
        return NextResponse.json({ 
            success: true, 
            user: {
                ...safeUser,
                id: user.id,
                name: user.name,
                role: user.role,
                signature: sig,
                isInitialPin,
                sessionId: jti || undefined,
                branchId: activeRec?.branchId || user.tenantId || 'default',
                capabilities,
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

            if (INITIAL_STAFF_PIN_VALUES.includes(cleanPin)) {
                return NextResponse.json({ success: false, error: 'Elige un PIN distinto al PIN inicial de acceso.' }, { status: 400 });
            }

            const letters = cleanPin.match(/[A-Za-z]/g) || [];
            const digits  = cleanPin.match(/\d/g) || [];
            
            // Requerir 5 caracteres: 1 letra y 4 números en cualquier orden
            if (cleanPin.length !== 5 || letters.length !== 1 || digits.length !== 4) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'El código de seguridad debe contener exactamente 5 caracteres (1 Letra y 4 Números en cualquier orden, ej. A1234, 1A234).' 
                }, { status: 400 });
            }

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

            return NextResponse.json({ success: true, message: 'PIN actualizado' });
        }

        return NextResponse.json({ success: false, error: 'Action not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
