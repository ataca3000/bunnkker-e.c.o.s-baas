import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { requireRole } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OIL_ALLOWED_ROLES = ['superadmin', 'admin'];

interface SchemaExplorerModule {
  exploreDatabaseSchema: (opts?: { writeCatalog?: boolean }) => Record<string, unknown>;
}

async function runReadOnlySchemaExplorer(writeCatalog: boolean) {
  const proc = process as unknown as {
    getBuiltinModule?: (id: string) => { createRequire?: (filename: string) => (id: string) => unknown };
  };
  const builtinModule = proc.getBuiltinModule?.('module');
  const requireFn = builtinModule?.createRequire
    ? builtinModule.createRequire(path.join(process.cwd(), 'package.json'))
    : (await import('node:module')).createRequire(path.join(process.cwd(), 'package.json'));

  const explorerEntry = path.join(process.cwd(), 'agent-operative', 'database-explorer', 'index.js');
  const explorerModule = requireFn(explorerEntry) as SchemaExplorerModule;
  return explorerModule.exploreDatabaseSchema({ writeCatalog });
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, OIL_ALLOWED_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const catalog = await runReadOnlySchemaExplorer(false);
    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error ejecutando Database Schema Explorer (OIL Fase 1).',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, OIL_ALLOWED_ROLES);
  if (!auth.ok) return auth.response;

  try {
    let writeCatalog = false;
    try {
      const body = await request.json();
      writeCatalog = Boolean(body?.writeCatalog);
    } catch {
      writeCatalog = false;
    }

    const catalog = await runReadOnlySchemaExplorer(writeCatalog);
    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error actualizando catálogo del Database Schema Explorer.',
      },
      { status: 500 }
    );
  }
}
