import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/apiAuth';
import { appendImmutableAudit } from '@/lib/immutableAudit';

/**
 * /api/workspace/export
 * Ejecuta exportaciones autorizadas hacia Google Sheets y Google Drive utilizando
 * exclusivamente el token OAuth en memoria enviado vía Bearer por el cliente.
 */

export async function POST(request: NextRequest) {
  const auth = requireCapability(request, 'workspace:export');
  if (!auth.ok) return auth.response;

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        code: 'WORKSPACE_TOKEN_REQUIRED',
        error: 'Se requiere autorización activa de Google Workspace para exportar.',
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const target = body?.target === 'drive' ? 'drive' : 'sheets';
    const title = String(body?.title || `BUNKKER Reporte ${new Date().toISOString().slice(0, 10)}`).slice(0, 120);
    const branchId = typeof body?.branchId === 'string' && body.branchId.trim() ? body.branchId.trim() : 'default';

    if (target === 'sheets') {
      const headersRow = Array.isArray(body?.headers)
        ? body.headers.map((h: unknown) => String(h))
        : ['Período', 'Órdenes', 'Ticket Promedio', 'Utilidad', 'Ventas'];
      const dataRows = Array.isArray(body?.rows)
        ? body.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map((cell) => (cell ?? '')) : []))
        : [];

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: 'Resumen Ejecutivo' } }],
        }),
      });

      const createJson = await createRes.json().catch(() => null);
      if (!createRes.ok || !createJson?.spreadsheetId) {
        return NextResponse.json(
          {
            success: false,
            error: createJson?.error?.message || 'Google Sheets rechazó la creación de la hoja.',
          },
          { status: createRes.status === 401 || createRes.status === 403 ? 401 : 502 }
        );
      }

      const spreadsheetId = createJson.spreadsheetId as string;
      const sheetTitle = createJson?.sheets?.[0]?.properties?.title || 'Resumen Ejecutivo';
      const values = [headersRow, ...dataRows];

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!appendRes.ok) {
        const appendErr = await appendRes.json().catch(() => null);
        return NextResponse.json(
          {
            success: false,
            error: appendErr?.error?.message || 'Hoja creada, pero falló la escritura de filas.',
          },
          { status: 502 }
        );
      }

      const url = createJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      appendImmutableAudit({
        branchId,
        actorId: auth.uid,
        actorRole: auth.role,
        action: 'WORKSPACE_EXPORT_SHEETS',
        resourceRef: spreadsheetId,
        details: { title, rowsCount: dataRows.length },
      });

      return NextResponse.json({
        success: true,
        target: 'sheets',
        fileId: spreadsheetId,
        title,
        url,
      });
    }

    // Target: Google Drive (JSON / CSV Backup)
    const fileName = String(body?.fileName || `bunkker-respaldo-${new Date().toISOString().slice(0, 10)}.json`).slice(0, 120);
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'application/json';
    const content =
      typeof body?.content === 'string'
        ? body.content
        : JSON.stringify(body?.payload ?? { exportedAt: new Date().toISOString(), branchId }, null, 2);

    const metadata = { name: fileName, mimeType };
    const boundary = `bunkker_boundary_${Date.now().toString(36)}`;
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const uploadJson = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok || !uploadJson?.id) {
      return NextResponse.json(
        {
          success: false,
          error: uploadJson?.error?.message || 'Google Drive rechazó la carga del respaldo.',
        },
        { status: uploadRes.status === 401 || uploadRes.status === 403 ? 401 : 502 }
      );
    }

    const url = uploadJson.webViewLink || `https://drive.google.com/file/d/${uploadJson.id}/view`;
    appendImmutableAudit({
      branchId,
      actorId: auth.uid,
      actorRole: auth.role,
      action: 'WORKSPACE_EXPORT_DRIVE',
      resourceRef: String(uploadJson.id),
      details: { fileName, mimeType },
    });

    return NextResponse.json({
      success: true,
      target: 'drive',
      fileId: uploadJson.id,
      title: uploadJson.name || fileName,
      url,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error ejecutando exportación a Google Workspace.' },
      { status: 500 }
    );
  }
}
