import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { saveMediaBuffer } from '@/lib/mediaStorage';
import { validateMediaFileMetadata } from '@/lib/storefrontBuilder';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireActiveRole(req, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(req);

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'No se recibió ningún archivo.' }, { status: 400 });
      }

      const validation = validateMediaFileMetadata(file.type, file.size);
      if (!validation.ok) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { fileName } = saveMediaBuffer(tenantId, file.type, buffer);
      const servedUrl = `/api/media/${encodeURIComponent(fileName)}?tenant=${encodeURIComponent(tenantId)}`;

      return NextResponse.json({
        success: true,
        url: servedUrl,
        mediaType: validation.mediaType,
        fileName,
        sizeBytes: buffer.length,
      });
    }

    // Fallback JSON payload (dataUrl base64)
    const body = await req.json().catch(() => null);
    if (!body || typeof body.dataUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'Formato de carga inválido.' }, { status: 400 });
    }

    const match = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ success: false, error: 'Data URL inválido.' }, { status: 400 });
    }

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const validation = validateMediaFileMetadata(mimeType, buffer.length);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { fileName } = saveMediaBuffer(tenantId, mimeType, buffer);
    const servedUrl = `/api/media/${encodeURIComponent(fileName)}?tenant=${encodeURIComponent(tenantId)}`;

    return NextResponse.json({
      success: true,
      url: servedUrl,
      mediaType: validation.mediaType,
      fileName,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[MEDIA UPLOAD ERROR]:', err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error al almacenar el archivo multimedia.' },
      { status: 500 }
    );
  }
}
