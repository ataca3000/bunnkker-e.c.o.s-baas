import bcrypt from 'bcryptjs';
import { hashPinSha256 } from './apiAuth';
import { INITIAL_STAFF_PINS } from './initialStaffPins';

export interface VerifiedPinActor {
    uid: string;
    name: string;
    role: string;
    isSupervisorOverride: boolean;
}

export type VerifyPinResult =
    | { ok: true; verifiedBy: VerifiedPinActor }
    | { ok: false; status: number; error: string };

export function isValidStaffPinFormat(pin: string): boolean {
    const clean = String(pin || '').trim();
    return /^[A-Za-z0-9]{4,6}$/.test(clean);
}

function buildPinVariants(rawInput: string) {
    const rawPin = rawInput.trim();
    const cleanPin = rawPin.toUpperCase();
    const strippedPin = cleanPin.startsWith('A') ? cleanPin.slice(1) : cleanPin;
    const prefixedPin = cleanPin.startsWith('A') ? cleanPin : `A${cleanPin}`;

    const plainVariants = Array.from(new Set([cleanPin, rawPin, strippedPin, prefixedPin].filter(Boolean)));
    const shaVariants = plainVariants.map((v) => hashPinSha256(v));

    return { rawPin, cleanPin, plainVariants, shaVariants };
}

async function matchesUserRecord(
    user: { id: string; pin?: string | null; pinHash?: string | null },
    plainVariants: string[],
    shaVariants: string[]
): Promise<boolean> {
    if (user.pinHash) {
        for (const variant of plainVariants) {
            try {
                if (await bcrypt.compare(variant, user.pinHash)) return true;
            } catch {}
        }
    }
    if (user.pin) {
        if (shaVariants.includes(user.pin) || plainVariants.includes(user.pin)) {
            return true;
        }
    }
    return false;
}

export async function verifyStaffPin(params: {
    pin: string;
    tenantId?: string;
    activeUserId?: string;
    prismaInstance?: any;
}): Promise<VerifyPinResult> {
    const rawPin = String(params.pin || '').trim();
    if (!isValidStaffPinFormat(rawPin)) {
        return {
            ok: false,
            status: 400,
            error: 'El NIP debe tener entre 4 y 6 caracteres alfanuméricos.',
        };
    }

    const tenantId = (params.tenantId || 'default').trim() || 'default';
    const { plainVariants, shaVariants } = buildPinVariants(rawPin);
    const db = params.prismaInstance || (await import('./prisma')).prisma;

    // 1. Verificar primero contra el usuario autenticado en sesión
    if (params.activeUserId) {
        try {
            const activeUser = await db.user.findUnique({
                where: { id: params.activeUserId },
                select: { id: true, name: true, role: true, active: true, tenantId: true, pin: true, pinHash: true },
            });

            if (activeUser && activeUser.active) {
                const matchedSelf = await matchesUserRecord(activeUser, plainVariants, shaVariants);
                if (matchedSelf) {
                    return {
                        ok: true,
                        verifiedBy: {
                            uid: activeUser.id,
                            name: activeUser.name || activeUser.id,
                            role: activeUser.role,
                            isSupervisorOverride: false,
                        },
                    };
                }
            }
        } catch (err: any) {
            console.error('[VerifyPIN] Error consultando usuario activo:', err?.message);
        }
    }

    // 2. Permitir autorización de supervisor (admin / superadmin) del mismo tenant
    try {
        const tenantUsers = await db.user.findMany({
            where: { tenantId, active: true },
            select: { id: true, name: true, role: true, active: true, pin: true, pinHash: true },
        });

        for (const candidate of tenantUsers) {
            const isSelf = params.activeUserId && candidate.id === params.activeUserId;
            const isSupervisor = ['admin', 'superadmin'].includes(candidate.role);
            if (!isSelf && !isSupervisor) continue;

            const matched = await matchesUserRecord(candidate, plainVariants, shaVariants);
            if (matched) {
                return {
                    ok: true,
                    verifiedBy: {
                        uid: candidate.id,
                        name: candidate.name || candidate.id,
                        role: candidate.role,
                        isSupervisorOverride: !isSelf,
                    },
                };
            }
        }
    } catch (err: any) {
        console.error('[VerifyPIN] Error verificando supervisores en BD:', err?.message);
    }

    // 3. Fallback controlado únicamente para cuentas iniciales sin personalizar en tenant 'default'
    if (tenantId === 'default') {
        let initialInfo: { role: string; name: string } | undefined;
        for (const v of [...plainVariants, rawPin.toLowerCase()]) {
            if (INITIAL_STAFF_PINS[v]) {
                initialInfo = INITIAL_STAFF_PINS[v];
                break;
            }
        }
        if (initialInfo) {
            const isDemoSession = Boolean(params.activeUserId && params.activeUserId.startsWith('demo-'));
            try {
                const roleUser = await db.user.findFirst({
                    where: { tenantId: 'default', role: initialInfo.role, active: true },
                    select: { id: true, name: true, role: true, pin: true, pinHash: true },
                });

                if (!roleUser && isDemoSession) {
                    return {
                        ok: true,
                        verifiedBy: {
                            uid: `demo-${initialInfo.role}`,
                            name: initialInfo.name,
                            role: initialInfo.role,
                            isSupervisorOverride: !params.activeUserId?.includes(initialInfo.role),
                        },
                    };
                }
            } catch {}
        }
    }

    return {
        ok: false,
        status: 401,
        error: 'NIP incorrecto. Ingresa tu NIP de usuario o el de un supervisor autorizado.',
    };
}
