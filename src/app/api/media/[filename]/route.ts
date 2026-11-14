import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/apiAuth';
import { resolveMediaFilePath, mimeFromFilename, sanitizeTenantSegment } from '@/lib/mediaStorage';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const queryTenant = req.nextUrl.searchParams.get('tenant');
    const tenantId = sanitizeTenantSegment(queryTenant || getTenantId(req));

    const filePath = resolveMediaFilePath(tenantId, filename);
    if (!filePath) {
      return NextResponse.json({ success: false, error: 'Archivo no encontrado.' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const contentType = mimeFromFilename(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('[MEDIA SERVE ERROR]:', err?.message);
    return NextResponse.json({ success: false, error: 'Error al servir archivo.' }, { status: 500 });
  }
}
