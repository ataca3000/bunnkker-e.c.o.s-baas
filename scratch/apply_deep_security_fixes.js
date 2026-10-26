const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. UPDATE src/lib/atomicFs.ts
{
  const filePath = path.join(root, 'src', 'lib', 'atomicFs.ts');
  const code = `import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * atomicWriteFileSync — Escritura Atómica Resistente a Apagones (Kernel Atomic Rename + Fsync)
 * 
 * 1. Escribe los datos en un archivo temporal con sufijo .tmp
 * 2. Ejecuta fs.fsyncSync(fd) obligando al disco SSD/HDD a vaciar el búfer de caché físico.
 * 3. Ejecuta fs.renameSync(temp, dest) que en sistemas NTFS y POSIX es una operación
 *    atómica del kernel: jamás produce archivos de 0 bytes o truncados a la mitad.
 * 4. Blindado contra entornos de solo lectura (Vercel Serverless / EROFS) con fallback a os.tmpdir().
 */
export function atomicWriteFileSync(filePath: string, data: string | Buffer, createBackup = false): string {
    let targetPath = filePath;
    let dir = path.dirname(targetPath);

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch {
        // Fallback para entornos Serverless de solo lectura (Vercel EROFS)
        const baseName = path.basename(filePath);
        dir = path.join(os.tmpdir(), 'bunnkker-ecos');
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch {
            dir = os.tmpdir();
        }
        targetPath = path.join(dir, baseName);
    }

    const tempPath = \`\${targetPath}.\${Date.now()}.\${Math.random().toString(36).substring(2, 7)}.tmp\`;

    // 1. Escribir y forzar vaciado a disco físico (fsync)
    const fd = fs.openSync(tempPath, 'w');
    try {
        if (typeof data === 'string') {
            fs.writeSync(fd, data, 0, 'utf-8');
        } else {
            fs.writeSync(fd, data, 0, data.length);
        }
        try {
            fs.fsyncSync(fd);
        } catch {
            // Algunos sistemas de archivos virtuales o en memoria no soportan fsync
        }
    } finally {
        fs.closeSync(fd);
    }

    // 2. Rotación previa si existe archivo previo y se solicita backup
    if (createBackup && fs.existsSync(targetPath)) {
        try {
            const bakPath = \`\${targetPath}.bak\`;
            fs.copyFileSync(targetPath, bakPath);
        } catch {
            // Ignorar error no crítico de rotación secundaria
        }
    }

    // 3. Renombramiento atómico
    fs.renameSync(tempPath, targetPath);
    return targetPath;
}
`;
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('✅ 1. src/lib/atomicFs.ts blindado con fallback EROFS a /tmp.');
}

// 2. UPDATE src/lib/salesCounter.ts
{
  const filePath = path.join(root, 'src', 'lib', 'salesCounter.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Asegurar import os y atomicWriteFileSync
  if (!content.includes("import os from 'os';")) {
    content = content.replace("import path from 'path';", "import path from 'path';\nimport os from 'os';\nimport { atomicWriteFileSync } from './atomicFs';");
  }

  // Corregir getStorageDir()
  const oldGetStorageDir = /function getStorageDir\(\): string \{[\s\S]*?return baseDir;\s*\}/;
  const newGetStorageDir = `function getStorageDir(): string {
  let baseDir: string;
  if (process.env.APPDATA) {
    baseDir = path.join(process.env.APPDATA, 'bunnkker-ecos', 'security');
  } else {
    baseDir = path.join(process.cwd(), 'data', 'security');
  }

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch {
    // Fallback seguro contra EROFS en Vercel Serverless
    try {
      const tmpDir = path.join(os.tmpdir(), 'bunnkker-ecos', 'security');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return os.tmpdir();
    }
  }
}`;

  if (oldGetStorageDir.test(content)) {
    content = content.replace(oldGetStorageDir, newGetStorageDir);
  }

  // Reemplazar fs.writeFileSync por atomicWriteFileSync
  content = content.replace(
    /fs\.writeFileSync\(filePath, JSON\.stringify\(data, null, 2\), 'utf-8'\);/g,
    `atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 2. src/lib/salesCounter.ts blindado contra crash EROFS y con atomicWrite.');
}

// 3. UPDATE src/lib/persistentSettings.ts
{
  const filePath = path.join(root, 'src', 'lib', 'persistentSettings.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes("import os from 'os';")) {
    content = content.replace("import path from 'path';", "import path from 'path';\nimport os from 'os';\nimport { atomicWriteFileSync } from './atomicFs';");
  }

  const oldGetStorageDir = /function getStorageDir\(\): string \{[\s\S]*?return baseDir;\s*\}/;
  const newGetStorageDir = `function getStorageDir(): string {
  let baseDir: string;
  if (process.env.APPDATA) {
    baseDir = path.join(process.env.APPDATA, 'bunnkker-ecos', 'settings');
  } else {
    baseDir = path.join(process.cwd(), 'data', 'settings');
  }

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch {
    // Fallback seguro para Vercel Serverless (Read-Only)
    try {
      const tmpDir = path.join(os.tmpdir(), 'bunnkker-ecos', 'settings');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return os.tmpdir();
    }
  }
}`;

  if (oldGetStorageDir.test(content)) {
    content = content.replace(oldGetStorageDir, newGetStorageDir);
  }

  // Reemplazar fs.writeFileSync por atomicWriteFileSync
  content = content.replace(
    /fs\.writeFileSync\(filePath, JSON\.stringify\(cleanData, null, 2\), 'utf-8'\);/g,
    `atomicWriteFileSync(filePath, JSON.stringify(cleanData, null, 2));`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 3. src/lib/persistentSettings.ts blindado contra crash EROFS y con atomicWrite.');
}

// 4. UPDATE src/app/api/store-checkout/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'store-checkout', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes("import crypto from 'crypto';")) {
    content = "import crypto from 'crypto';\n" + content;
  }

  // A. Generación de folio criptoseguro sin colisiones
  content = content.replace(
    /const orderId = `ORD-\$\{Date\.now\(\)\.toString\(\)\.slice\(-6\)\}`;/,
    `const orderId = \`ORD-\${Date.now()}-\${crypto.randomBytes(3).toString('hex').toUpperCase()}\`;`
  );

  // B. En checkout público de catálogo, el status inicial debe ser pending_payment a menos que exista pago confirmado
  content = content.replace(
    /status: isDelivery \? 'READY_TO_SHIP' : 'paid',/,
    `// SEGURIDAD: En checkout público online sin pasarela verificada, la orden nace como pendiente de cobro en mostrador/reparto
                    status: 'pending_payment',`
  );

  content = content.replace(
    /paymentMethod: 'Online',/,
    `paymentMethod: 'pago_caja',`
  );

  content = content.replace(
    /confirmedAt: new Date\(\),/,
    `confirmedAt: null,`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 4. src/app/api/store-checkout/route.ts blindado contra compras gratis y colisiones de folio.');
}

// 5. UPDATE src/app/api/users/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'users', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Bloquear escalada de privilegios de admin a superadmin
  const roleCheckInjection = `if (!name || !pin || !role) {
            return NextResponse.json({ success: false, error: 'Name, PIN and role are required.' }, { status: 400 });
        }

        // SEGURIDAD: Control estricto de escalada de privilegios. Solo un Superadmin puede crear un Superadmin.
        if (role === 'superadmin' && auth.role !== 'superadmin') {
            return NextResponse.json({ 
                success: false, 
                error: 'Acceso denegado: Solo un Superadmin (Dueño) puede asignar o crear usuarios con rol Superadmin.' 
            }, { status: 403 });
        }`;

  content = content.replace(
    /if \(!name \|\| !pin \|\| !role\) \{\s*return NextResponse\.json\(\{ success: false, error: 'Name, PIN and role are required\.' \}, \{ status: 400 \}\);\s*\}/,
    roleCheckInjection
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 5. src/app/api/users/route.ts blindado contra escalada de privilegios de admin a superadmin.');
}

// 6. UPDATE src/app/api/sales/close-register/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'sales', 'close-register', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // A. Cambiar validateApiSession por requireRole
  content = content.replace(
    "import { validateApiSession, getTenantId } from '@/lib/apiAuth';",
    "import { requireRole, getTenantId } from '@/lib/apiAuth';"
  );

  content = content.replace(
    "const auth = validateApiSession(request);",
    "const auth = requireRole(request, ['superadmin', 'admin', 'sales']);"
  );

  // B. Anti-suplantación: el cashierId debe derivarse de auth.uid
  const oldCashierExtract = /const \{ declaredAmount, cashierId, cashierName \} = body;\s*if \(declaredAmount === undefined \|\| !cashierId\) \{[\s\S]*?return NextResponse\.json\(\{ error: 'Faltan datos requeridos \(declaredAmount, cashierId\)' \}, \{ status: 400 \}\);\s*\}/;
  const newCashierExtract = `const { declaredAmount } = body;
        if (declaredAmount === undefined) {
            return NextResponse.json({ error: 'Faltan datos requeridos: declaredAmount' }, { status: 400 });
        }

        // ANTI-SUPLANTACIÓN: El cajero que cierra se extrae de la sesión autenticada y verificada
        // Solo un administrador o superadministrador puede especificar un cashierId alterno de un empleado a su cargo
        const effectiveCashierId = (['superadmin', 'admin'].includes(auth.role) && body.cashierId) ? body.cashierId : auth.uid;
        const effectiveCashierName = body.cashierName || (auth as any).name || 'Cajero';`;

  if (oldCashierExtract.test(content)) {
    content = content.replace(oldCashierExtract, newCashierExtract);
  }

  // C. Optimización SQL: Filtrar en Prisma directamente por fecha en lugar de traer todo el historial
  content = content.replace(
    /const candidateOrders = await prisma\.order\.findMany\(\{[\s\S]*?where:\s*\{[\s\S]*?tenantId,[\s\S]*?paymentMethod: \{ in: CASH_PAYMENT_METHODS \},[\s\S]*?status: \{ notIn: EXCLUDED_CLOSE_STATUSES \},[\s\S]*?OR: \[[\s\S]*?\{ status: \{ in: ALLOWED_CLOSE_STATUSES \} \},[\s\S]*?\{ confirmedAt: \{ not: null \} \}[\s\S]*?\][\s\S]*?\}\s*\}\);/,
    `const candidateOrders = await prisma.order.findMany({
            where: {
                tenantId,
                paymentMethod: { in: CASH_PAYMENT_METHODS },
                status: { notIn: EXCLUDED_CLOSE_STATUSES },
                date: { gte: cutoffDate },
                OR: [
                    { status: { in: ALLOWED_CLOSE_STATUSES } },
                    { confirmedAt: { not: null } }
                ]
            }
        });`
  );

  // D. Usar effectiveCashierId y effectiveCashierName en la creación de log
  content = content.replace(/cashierId,/g, 'cashierId: effectiveCashierId,');
  content = content.replace(/cashierName,/g, 'cashierName: effectiveCashierName,');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 6. src/app/api/sales/close-register/route.ts blindado con RBAC estricto, anti-suplantación y filtro SQL eficiente.');
}

// 7. UPDATE src/app/api/backup/status/route.ts
{
  const filePath = path.join(root, 'src', 'app', 'api', 'backup', 'status', 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes("import { atomicWriteFileSync } from '@/lib/atomicFs';")) {
    content = "import { atomicWriteFileSync } from '@/lib/atomicFs';\n" + content;
  }

  // Reemplazar escrituras con atomicWriteFileSync
  content = content.replace(
    /fs\.writeFileSync\(BACKUP_CONFIG_PATH, JSON\.stringify\(merged, null, 2\), 'utf-8'\);/,
    `atomicWriteFileSync(BACKUP_CONFIG_PATH, JSON.stringify(merged, null, 2));`
  );

  content = content.replace(
    /fs\.writeFileSync\(jsonFile, jsonBackup, 'utf-8'\);/g,
    `atomicWriteFileSync(jsonFile, jsonBackup);`
  );

  content = content.replace(
    /fs\.writeFileSync\(excelFile, csvContent, 'utf-8'\);/g,
    `atomicWriteFileSync(excelFile, csvContent);`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 7. src/app/api/backup/status/route.ts integrado con atomicWriteFileSync contra apagones.');
}

console.log('🚀 Todas las reparaciones de seguridad y rendimiento aplicadas con éxito.');
