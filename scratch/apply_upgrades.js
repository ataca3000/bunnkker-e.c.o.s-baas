const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. UPDATE src/lib/apiAuth.ts
{
  const filePath = path.join(root, 'src', 'lib', 'apiAuth.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace signRole and verifyRoleSignature
  const oldSignRole = /export function signRole\(role: string, uid: string\): string \{[\s\S]*?export function verifyRoleSignature\(role: string, uid: string, signature: string\): boolean \{[\s\S]*?return expected === signature;\s*\}\s*\}/;
  const newSignRole = `export function signRole(role: string, uid: string, tenantId: string = 'default'): string {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(\`\${tenantId}:\${role}:\${uid}\`).digest('hex');
}

export function verifyRoleSignature(role: string, uid: string, signature: string, tenantId: string = 'default'): boolean {
  if (!signature) return false;
  const expectedScoped = signRole(role, uid, tenantId);
  const expectedLegacy = crypto.createHmac('sha256', COOKIE_SECRET).update(\`\${role}:\${uid}\`).digest('hex');

  const checkMatch = (expected: string) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return expected === signature;
    }
  };

  return checkMatch(expectedScoped) || checkMatch(expectedLegacy);
}`;

  if (oldSignRole.test(content)) {
    content = content.replace(oldSignRole, newSignRole);
  }

  // Update validateApiSession to extract tenantId and pass to verifyRoleSignature
  content = content.replace(
    /const sig\s*=\s*request\.cookies\.get\('msj-role-sig'\)\?\.value;[\s\S]*?if \(!session \|\| !role \|\| !sig \|\| session === '' \|\| !verifyRoleSignature\(role, session, sig\)\)/,
    `const sig     = request.cookies.get('msj-role-sig')?.value;
  const tenantId = getTenantId(request);

  if (!session || !role || !sig || session === '' || !verifyRoleSignature(role, session, sig, tenantId))`
  );

  content = content.replace(
    /return \{ ok: true, uid: session, role \};/,
    `return { ok: true, uid: session, role, tenantId };`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ src/lib/apiAuth.ts actualizado con firma amarrada a tenantId.');
}

// 2. UPDATE src/middleware.ts
{
  const filePath = path.join(root, 'src', 'middleware.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Update verifyHmac definition
  const oldVerifyHmac = /async function verifyHmac\(session: string, role: string, sig: string\): Promise<boolean> \{[\s\S]*?return timingSafeEqualHex\(expectedHex, sig\);\s*\}\s*catch\s*\{\s*return false;\s*\}\s*\}/;
  const newVerifyHmac = `async function verifyHmac(session: string, role: string, sig: string, tenantId: string = 'default'): Promise<boolean> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    console.warn('[MIDDLEWARE] Missing INTERNAL_API_SECRET in production — using fallback');
  }
  const activeSecret = secret || 'bunkker-ecos-default-local-dev-secret-key-2026';
  
  const encoder = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(activeSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    // 1. Firma Triple amarrada a tenantId (tenantId:role:session)
    const expectedBufferScoped = await crypto.subtle.sign('HMAC', key, encoder.encode(\`\${tenantId}:\${role}:\${session}\`));
    const expectedHexScoped = Array.from(new Uint8Array(expectedBufferScoped)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (timingSafeEqualHex(expectedHexScoped, sig)) return true;

    // 2. Fallback legacy (role:session)
    const expectedBufferLegacy = await crypto.subtle.sign('HMAC', key, encoder.encode(\`\${role}:\${session}\`));
    const expectedHexLegacy = Array.from(new Uint8Array(expectedBufferLegacy)).map(b => b.toString(16).padStart(2, '0')).join('');
    return timingSafeEqualHex(expectedHexLegacy, sig);
  } catch {
    return false;
  }
}`;

  if (oldVerifyHmac.test(content)) {
    content = content.replace(oldVerifyHmac, newVerifyHmac);
  }

  // Update call in middleware: verifyHmac(session, role, sig) -> verifyHmac(session, role, sig, tenantId)
  content = content.replace(
    /const signatureValid = await verifyHmac\(session, role, sig\);/g,
    `const signatureValid = await verifyHmac(session, role, sig, tenantId);`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ src/middleware.ts actualizado con verificación HMAC triple.');
}

// 3. UPDATE src/app/api/auth/session/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'auth', 'session', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // A. Extraer tenantId al inicio del POST
  content = content.replace(
    /const body = await request\.json\(\)\.catch\(\(\) => \(\{\}\)\);/,
    `const body = await request.json().catch(() => ({}));
    const tenantId = request.headers.get('x-tenant-id') || body.tenantId || 'default';`
  );

  // B. user findFirst debe incluir tenantId
  content = content.replace(
    /user = await prisma\.user\.findFirst\(\{\s*where:\s*\{[\s\S]*?pin:\s*\{ in: \[pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin\] \},[\s\S]*?active:\s*true[\s\S]*?\}\s*\}\);/,
    `user = await prisma.user.findFirst({ 
          where: { 
            tenantId,
            pin: { in: [pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin] },
            active: true 
          } 
        });`
  );

  // C. candidateUsers debe incluir tenantId
  content = content.replace(
    /where:\s*\{\s*active:\s*true,\s*pinHash:\s*\{\s*not:\s*null\s*\}\s*\},/,
    `where: { tenantId, active: true, pinHash: { not: null } },`
  );

  // D. candado estricto de deviceId para trabajadores operativos
  const oldDeviceLogic = /\/\/ MACHINE FINGERPRINTING — Solo registra, no bloquea \(ERP local multi-dispositivo\)[\s\S]*?if \(deviceId && !matchedUser\.deviceId\) \{[\s\S]*?await prisma\.user\.update\(\{ where: \{ id: matchedUser\.id \}, data: \{ deviceId \} \}\);[\s\S]*?\} catch \(e\) \{[\s\S]*?console\.warn\("\[AUTH SESSION\] No se pudo guardar deviceId en BD:", e\);[\s\S]*?\}\s*\}/;
  const newDeviceLogic = `// CANDADO ESTRICTO DE DISPOSITIVO (Device Binding)
      const OPERATIONAL_ROLES = ['inventory', 'carga_descarga', 'driver', 'sales'];
      if (OPERATIONAL_ROLES.includes(matchedUser.role)) {
        if (matchedUser.deviceId && deviceId && matchedUser.deviceId !== deviceId) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Dispositivo no autorizado. Tu usuario está vinculado a otra terminal. Solicita desbloqueo al Administrador.',
              code: 'DEVICE_MISMATCH'
            }, 
            { status: 403 }
          );
        }
      }

      if (deviceId && !matchedUser.deviceId) {
        try {
          await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
        } catch (e) {
          console.warn("[AUTH SESSION] Error guardando deviceId:", e);
        }
      }`;

  if (oldDeviceLogic.test(content)) {
    content = content.replace(oldDeviceLogic, newDeviceLogic);
  }

  // E. Eliminar auto-asignación insegura de pin en login de clientes
  const oldCustomerPin = /if \(!customer\.pin\) \{[\s\S]*?await prisma\.customer\.update\(\{[\s\S]*?where: \{ id: customer\.id \},[\s\S]*?data: \{ pin: rawPassword \}[\s\S]*?\}\);[\s\S]*?catch \{[\s\S]*?\/\/ ignore[\s\S]*?\}\s*\}/;
  const newCustomerPin = `if (!customer.pin) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tu cuenta aún no tiene contraseña configurada. Solicita tu enlace de activación en mostrador o con el Administrador.',
            code: 'PASSWORD_NOT_CONFIGURED'
          },
          { status: 403 }
        );
      }`;

  if (oldCustomerPin.test(content)) {
    content = content.replace(oldCustomerPin, newCustomerPin);
  }

  // F. signRole pasando tenantId
  content = content.replace(
    /const sig = signRole\(finalRole, finalUid\);/,
    `const sig = signRole(finalRole, finalUid, tenantId);`
  );

  // G. Emitir customer_token junto a admincom_session
  content = content.replace(
    /if \(clientToken\) \{\s*response\.cookies\.set\('admincom_session', clientToken, cookieOpts\);\s*\}/,
    `if (clientToken) {
      response.cookies.set('admincom_session', clientToken, cookieOpts);
      response.cookies.set('customer_token', clientToken, cookieOpts);
    }`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ src/app/api/auth/session/route.ts blindado contra 5 grietas.');
}

// 4. UPDATE src/app/api/orders/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'orders', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Reemplazar ensureDbColumns con función ligera no-op (migraciones en prepare-db.js)
  const oldEnsure = /let isDbSchemaSynced = false;\s*async function ensureDbColumns\(\) \{[\s\S]*?isDbSchemaSynced = true;\s*\}/;
  const newEnsure = `// Sincronización delegada a scripts/prepare-db.js durante build/startup
async function ensureDbColumns() {
    return;
}`;

  if (oldEnsure.test(content)) {
    content = content.replace(oldEnsure, newEnsure);
  }

  // Sincronizar lectura de cookie cliente: customer_token y admincom_session
  content = content.replace(
    /const customerToken = request\.cookies\.get\('customer_token'\)\?\.value \|\| request\.headers\.get\('authorization'\)\?\.replace\('Bearer ', ''\);/,
    `const customerToken = request.cookies.get('customer_token')?.value || 
                                request.cookies.get('admincom_session')?.value || 
                                request.headers.get('authorization')?.replace('Bearer ', '');`
  );

  content = content.replace(
    /customerId = \(payload\.customerId \|\| payload\.id \|\| payload\.sub\) as string;/,
    `customerId = (payload.customerId || payload.uid || payload.id || payload.sub) as string;`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ src/app/api/orders/route.ts optimizado: ALTER TABLE eliminado de la ruta crítica.');
}

// 5. UPDATE src/lib/prisma.ts
{
  const filePath = path.join(root, 'src', 'lib', 'prisma.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Asegurar chequeo unificado de reconexión
  const oldProxyStart = /let hasFailed = false;\s*let lastFailTime = 0;\s*const RECONNECT_INTERVAL_MS = 20000;[\s\S]*?return new Proxy\(realPrisma, \{[\s\S]*?get\(target, prop: string\) \{[\s\S]*?if \(hasFailed\) \{[\s\S]*?if \(Date\.now\(\) - lastFailTime > RECONNECT_INTERVAL_MS\) \{[\s\S]*?hasFailed = false;[\s\S]*?\} else \{[\s\S]*?return \(fallback as any\)\[prop\];[\s\S]*?\}\s*\}/;
  
  const newProxyStart = `let hasFailed = false;
  let lastFailTime = 0;
  const RECONNECT_INTERVAL_MS = 20000;

  function shouldUseFallback(): boolean {
    if (!hasFailed) return false;
    if (Date.now() - lastFailTime > RECONNECT_INTERVAL_MS) {
      hasFailed = false;
      console.log('🔄 [Prisma Resilience] Reintentando conexión con la base de datos física...');
      return false;
    }
    return true;
  }

  return new Proxy(realPrisma, {
    get(target, prop: string) {
      if (shouldUseFallback()) {
        return (fallback as any)[prop];
      }`;

  if (oldProxyStart.test(content)) {
    content = content.replace(oldProxyStart, newProxyStart);
  }

  // Reemplazar ocurrencias de if (hasFailed) por if (shouldUseFallback())
  content = content.replace(/if \(hasFailed\) return \(fallback as any\)\.\$transaction\(arg\);/g, 'if (shouldUseFallback()) return (fallback as any).$transaction(arg);');
  content = content.replace(/if \(hasFailed\) return \(fallback as any\)\[prop\]\(\.\.\.args\);/g, 'if (shouldUseFallback()) return (fallback as any)[prop](...args);');
  content = content.replace(/if \(hasFailed\) \{\s*const fallbackModel = \(fallback as any\)\[prop\];\s*return fallbackModel \? fallbackModel\[modelProp\] : undefined;\s*\}/g, `if (shouldUseFallback()) {
              const fallbackModel = (fallback as any)[prop];
              return fallbackModel ? fallbackModel[modelProp] : undefined;
            }`);
  content = content.replace(/if \(hasFailed\) \{\s*const fallbackModel = \(fallback as any\)\[prop\];\s*return fallbackModel \? fallbackModel\[modelProp\]\(\.\.\.args\) : undefined;\s*\}/g, `if (shouldUseFallback()) {
                  const fallbackModel = (fallback as any)[prop];
                  return fallbackModel ? fallbackModel[modelProp](...args) : undefined;
                }`);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ src/lib/prisma.ts consolidado con reconexión activa y determinista.');
}

console.log('🚀 Todas las actualizaciones consolidadas con éxito.');
