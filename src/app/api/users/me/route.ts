import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

        const user = await prisma.user.findUnique({
            where: { id: session }
        });

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
            
            if (!newPin || newPin.length < 4 || newPin.length > 6 || newPin === '0000') {
                return NextResponse.json({ success: false, error: 'PIN inválido' }, { status: 400 });
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
