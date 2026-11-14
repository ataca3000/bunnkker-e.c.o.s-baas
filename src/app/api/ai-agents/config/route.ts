import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_GEMINI_MODEL, hasServerGeminiKey } from '@/lib/geminiClient';
import { loadPersistentAgentConfigs, savePersistentAgentConfigs } from '@/lib/persistentSettings';

type AgentRole = 'support' | 'cashier' | 'warehouse' | 'delivery' | 'owner';

const AGENT_ROLES: AgentRole[] = ['support', 'cashier', 'warehouse', 'delivery', 'owner'];
const PROVIDER_KEY = 'ai_agents_config';

interface AgentConfig {
  enabled: boolean;
  privateScope: boolean;
  instructions: string;
  updatedAt?: string;
}

function sanitizeConfig(value: unknown): AgentConfig {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    enabled: input.enabled !== false,
    privateScope: input.privateScope !== false,
    instructions: typeof input.instructions === 'string' ? input.instructions.slice(0, 1200) : '',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
  };
}

function buildPublicMap(raw: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(
    AGENT_ROLES.map((role) => [role, raw?.[role] ? sanitizeConfig(raw[role]) : null])
  );
}

async function readConfigs(tenantId: string): Promise<Record<string, AgentConfig>> {
  try {
    const dbRow = await prisma.integrationConfig.findFirst({
      where: { tenantId, provider: PROVIDER_KEY },
    });
    if (dbRow?.settings) {
      const parsed = JSON.parse(dbRow.settings) as Record<string, unknown>;
      savePersistentAgentConfigs(tenantId, parsed);
      return buildPublicMap(parsed) as Record<string, AgentConfig>;
    }
  } catch (err) {
    console.warn('[AI AGENTS] Error leyendo Prisma integrationConfig, usando respaldo en disco:', err);
  }
  return buildPublicMap(loadPersistentAgentConfigs(tenantId)) as Record<string, AgentConfig>;
}

async function writeConfigs(tenantId: string, configs: Record<string, unknown>, updatedBy: string) {
  savePersistentAgentConfigs(tenantId, configs);
  const serialized = JSON.stringify(configs);
  try {
    const existing = await prisma.integrationConfig.findFirst({
      where: { tenantId, provider: PROVIDER_KEY },
    });
    if (existing) {
      await prisma.integrationConfig.update({
        where: { id: existing.id },
        data: {
          settings: serialized,
          status: hasServerGeminiKey() ? 'connected' : 'local_fallback',
          updatedBy,
        },
      });
    } else {
      await prisma.integrationConfig.create({
        data: {
          tenantId,
          provider: PROVIDER_KEY,
          settings: serialized,
          status: hasServerGeminiKey() ? 'connected' : 'local_fallback',
          updatedBy,
        },
      });
    }
  } catch (err) {
    console.warn('[AI AGENTS] Error persistiendo en Prisma (respaldo local activo):', err);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);
  const configs = await readConfigs(tenantId);

  return NextResponse.json({
    success: true,
    engine: hasServerGeminiKey() ? 'gemini' : 'local',
    model: DEFAULT_GEMINI_MODEL,
    configs,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);

  try {
    const body = await request.json();
    const role = body?.role as AgentRole;
    if (!AGENT_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Rol de agente inválido.' }, { status: 400 });
    }

    const config = sanitizeConfig({
      ...(body?.config || {}),
      updatedAt: new Date().toISOString(),
    });

    const current = await readConfigs(tenantId);
    const updated = { ...current, [role]: config };
    await writeConfigs(tenantId, updated, auth.uid);

    return NextResponse.json({
      success: true,
      engine: hasServerGeminiKey() ? 'gemini' : 'local',
      config,
    });
  } catch (error) {
    console.error('[AI AGENTS] Error guardando configuración:', error);
    return NextResponse.json({ success: false, error: 'No se pudo guardar la configuración.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);

  try {
    const body = await request.json();
    const role = body?.role as AgentRole;
    if (!AGENT_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Rol de agente inválido.' }, { status: 400 });
    }

    const current = await readConfigs(tenantId);
    delete current[role];
    await writeConfigs(tenantId, current, auth.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI AGENTS] Error eliminando configuración:', error);
    return NextResponse.json({ success: false, error: 'No se pudo eliminar la configuración.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
