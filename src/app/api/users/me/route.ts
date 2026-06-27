import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRoleSignature } from '@/lib/apiAuth';

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

        // omit pin
        const { pin, ...safeUser } = user;
        
        return NextResponse.json({ 
            success: true, 
            user: {
                ...safeUser,
                uid: safeUser.id,
                displayName: safeUser.name
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
