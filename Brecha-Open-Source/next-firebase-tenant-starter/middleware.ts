import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_DOMAINS = ['yourdomain.com', 'localhost:3000'];

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Extract tenant from subdomain (e.g., clientA.yourdomain.com)
  let tenantId = 'default';
  if (!PUBLIC_DOMAINS.includes(hostname)) {
    tenantId = hostname.split('.')[0];
  }

  // Inject tenant into headers for backend isolation
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api/public|_next/static|_next/image|favicon.ico).*)'],
};
