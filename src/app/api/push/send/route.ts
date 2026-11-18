import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import {
  dispatchCriticalAdminPush,
  isValidEarlyWarningCategory,
  type EarlyWarningSeverity,
} from '@/lib/fcmPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_PUSH_ROLES = ['superadmin', 'admin'];

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ADMIN_PUSH_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const tenantId = getTenantId(request);
    const body = await request.json().catch(() => ({}));

    const category = isValidEarlyWarningCategory(body?.category)
      ? body.category
      : 'TEST_ALERT';

    const severity: EarlyWarningSeverity | undefined =
      body?.severity === 'critical' || body?.severity === 'warning' || body?.severity === 'info'
        ? body.severity
        : undefined;

    const result = await dispatchCriticalAdminPush({
      tenantId,
      category,
      severity,
      title: typeof body?.title === 'string' ? body.title : undefined,
      body: typeof body?.body === 'string' ? body.body : undefined,
      url: typeof body?.url === 'string' ? body.url : undefined,
      actorUid: auth.uid,
      actorName: typeof body?.actorName === 'string' ? body.actorName : auth.role,
      metadata:
        body?.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : { triggeredBy: auth.uid },
    });

    return NextResponse.json({
      success: true,
      data: result.alert,
      hasFcmServerCredentials: result.hasFcmServerCredentials,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error enviando notificación push crítica.',
      },
      { status: 500 }
    );
  }
}
