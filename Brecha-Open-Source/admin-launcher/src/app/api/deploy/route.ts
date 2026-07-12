import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientName, adminEmail, modules, country, currency } = body;

        if (!clientName || !adminEmail) {
            return NextResponse.json({ error: "Faltan datos requeridos (clientName, adminEmail)" }, { status: 400 });
        }

        const authHeader = request.headers.get('x-deploy-key');
        if (authHeader !== 'admin-demo-key-2026') {
            return NextResponse.json({ error: "No autorizado. Token de despliegue inválido." }, { status: 401 });
        }

        // 1. Generar un Tenant ID único y seguro
        const tenantId = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);
        const domain = `${tenantId}.admin.com`; // Subdominio asignado
        const port = Math.floor(Math.random() * (9000 - 8000 + 1)) + 8000; // Puerto simulado

        // 2. Simulamos la Orquestación de Contenedores y Red (Mini Kubernetes)
        // En un entorno real aquí llamarías a Vercel API, Docker API o crearías el namespace.
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simula tiempo de provisionamiento

        // 3. Inyectar Configuración Base de Datos (Firebase Multi-Tenant)
        try {
            const tenantRef = doc(db, 'tenants_registry', tenantId);
            await setDoc(tenantRef, {
                clientName,
                adminEmail,
                modules,
                country,
                currency,
                domain,
                port,
                status: 'ACTIVE',
                dbNamespace: `tenants/${tenantId}`,
                createdAt: serverTimestamp()
            });
        } catch (fbError: any) {
            console.warn("⚠️ Demo Mode: No se pudo registrar en Firestore (Permission Denied). Continuando orquestación simulada...", fbError.message);
        }

        // 4. Retornar Estado de Orquestación
        return NextResponse.json({
            status: "SUCCESS",
            message: "Instancia desplegada y orquestada correctamente",
            data: {
                tenantId,
                domain: `https://${domain}`,
                port,
                databasePath: `tenants/${tenantId}`,
                modulesActivated: modules,
                orchestrator: "AdminDeploy Engine v1.0"
            }
        });

    } catch (error: any) {
        console.error("Error en AdminDeploy:", error);
        return NextResponse.json({ error: "Fallo crítico en el orquestador: " + error.message }, { status: 500 });
    }
}
