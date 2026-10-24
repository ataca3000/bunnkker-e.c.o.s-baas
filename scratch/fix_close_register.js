const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'app', 'api', 'sales', 'close-register', 'route.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('userId: cashierId: effectiveCashierId,', 'userId: effectiveCashierId,');
content = content.replace(/cashierName \|\| 'Cajero'/g, 'effectiveCashierName');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Corregido close-register/route.ts');
