const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'app', 'api', 'auth', 'session', 'route.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'const { idToken, uid, pin, deviceId } = body;',
  `const { idToken, uid, pin, deviceId } = body;\n    const tenantId = request.headers.get('x-tenant-id') || body.tenantId || 'default';`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ tenantId definido correctamente en session/route.ts');
