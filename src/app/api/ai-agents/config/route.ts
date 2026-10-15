import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, hasRealCredentials } from '@/lib/firebase';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import { loadPersistentAgentConfigs, savePersistentAgentConfigs } from '@/lib/persistentSettings';

type AgentRole = 'support' | 'cashier' | 'warehouse' | 'delivery' | 'owner';

const AGENT_ROLES: AgentRole[] = ['support', 'cashier', 'warehouse', 'delivery', 'owner'];
const MAX_TEXT_LENGTH = 160;

interface AgentConfig {
  provider: string;
  model: string;
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  privateScope: boolean;
}

function sanitizeConfig(value: unknown): AgentConfig {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    provider: typeof input.provider === 'string' ? input.provider.slice(0, MAX_TEXT_LENGTH) : 'vercel-ai-gateway',
    model: typeof input.model === 'string' ? input.model.slice(0, MAX_TEXT_LENGTH) : '',
    endpoint: typeof input.endpoint === 'string' ? input.endpoint.slice(0, 500) : '',
    apiKey: typeof input.apiKey === 'string' ? input.apiKey.slice(0, 500) : undefined,
    enabled: input.enabled !== false,
    privateScope: input.privateScope !== false,
  };
}

function maskConfig(config: AgentConfig): AgentConfig {
  return {
    ...config,
    apiKey: config.apiKey ? `••••••••${config.apiKey.slice(-4)}` : '',
  };
}

function configRef(tenantId: string) {
  return doc(db, 'tenants', tenantId, 'settings', 'ai_agents');
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);

  if (!hasRealCredentials) {
    const local = loadPersistentAgentConfigs(tenantId);
    const configs = Object.fromEntries(
      AGENT_ROLES.map((role) => [role, local?.[role] ? maskConfig(sanitizeConfig(local[role])) : null])
    );
    return NextResponse.json({ success: true, configs });
  }

  try {
    const snapshot = await getDoc(configRef(tenantId));
    const data = snapshot.exists() ? snapshot.data().configs : {};
    const configs = Object.fromEntries(
      AGENT_ROLES.map((role) => [role, data?.[role] ? maskConfig(sanitizeConfig(data[role])) : null])
    );
    // Respaldar localmente
    savePersistentAgentConfigs(tenantId, data || {});
    return NextResponse.json({ success: true, configs });
  } catch (error) {
    console.error('[AI AGENTS] Error cargando configuración cloud, usando respaldo local:', error);
    const local = loadPersistentAgentConfigs(tenantId);
    const configs = Object.fromEntries(
      AGENT_ROLES.map((role) => [role, local?.[role] ? maskConfig(sanitizeConfig(local[role])) : null])
    );
    return NextResponse.json({ success: true, configs });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);

  try {
    const body = await request.json();
    const role = body?.role as AgentRole;
    if (!AGENT_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Rol de agente inválido.' }, { status: 400 });
    }

    const config = sanitizeConfig(body.config);
    if (!config.provider || !config.model) {
      return NextResponse.json({ success: false, error: 'Proveedor y modelo son obligatorios.' }, { status: 400 });
    }

    // Persistir localmente de forma obligatoria (Soberanía Local-First)
    const local = loadPersistentAgentConfigs(tenantId);
    const existingLocalKey = local[role]?.apiKey;
    if (!config.apiKey || config.apiKey.startsWith('••••••••')) {
      config.apiKey = existingLocalKey;
    }
    local[role] = config;
    savePersistentAgentConfigs(tenantId, local);

    if (!hasRealCredentials) {
      return NextResponse.json({ success: true, config: maskConfig(config), localOnly: true });
    }

    const reference = configRef(tenantId);
    const current = await getDoc(reference);
    const existing = current.exists() ? current.data().configs || {} : {};
    const existingKey = existing[role]?.apiKey;
    if (!config.apiKey || config.apiKey.startsWith('••••••••')) config.apiKey = existingKey;

    await setDoc(reference, {
      configs: { ...existing, [role]: config },
      updatedAt: new Date().toISOString(),
      updatedBy: auth.uid,
    }, { merge: true });

    return NextResponse.json({ success: true, config: maskConfig(config) });
  } catch (error) {
    console.error('[AI AGENTS] Error guardando configuración:', error);
    return NextResponse.json({ success: false, error: 'No se pudo guardar la configuración.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);

  try {
    const body = await request.json();
    const role = body?.role as AgentRole;
    if (!AGENT_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Rol de agente inválido.' }, { status: 400 });
    }

    const local = loadPersistentAgentConfigs(tenantId);
    delete local[role];
    savePersistentAgentConfigs(tenantId, local);

    if (!hasRealCredentials) {
      return NextResponse.json({ success: true, localOnly: true });
    }

    const reference = configRef(tenantId);
    const current = await getDoc(reference);
    const existing = current.exists() ? current.data().configs || {} : {};
    delete existing[role];
    await setDoc(reference, { configs: existing, updatedAt: new Date().toISOString(), updatedBy: auth.uid }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI AGENTS] Error eliminando configuración:', error);
    return NextResponse.json({ success: false, error: 'No se pudo eliminar la configuración.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
