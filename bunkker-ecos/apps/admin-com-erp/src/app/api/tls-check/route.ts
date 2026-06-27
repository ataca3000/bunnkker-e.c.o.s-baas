import { NextResponse } from 'next/server';
import { db } from '@bunkker/core';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({ error: "No domain provided" }, { status: 400 });
    }

    // Dominios principales de la plataforma siempre permitidos
    const mainDomains = ['admin.com', 'www.admin.com'];
    if (mainDomains.includes(domain)) {
        return new NextResponse("OK", { status: 200 });
    }

    try {
        // Verificar si el dominio pertenece a un cliente activo en Firebase
        const tenantsRef = collection(db, 'tenants_registry');
        const q = query(tenantsRef, where("domain", "==", domain), where("status", "==", "ACTIVE"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // El dominio es válido y el cliente está activo, autorizar certificado
            return new NextResponse("OK", { status: 200 });
        } else {
            // Dominio no autorizado, denegar certificado
            return new NextResponse("Unauthorized", { status: 403 });
        }
    } catch (error) {
        console.error("Error validando dominio:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
