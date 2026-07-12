const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db', { readonly: true });
console.log('Tablas:', db.prepare("SELECT name FROM sqlite_master WHERE type=\'table\'").all());
try { console.log('users count:', db.prepare("SELECT count(*) as c FROM users").get().c); } catch(e){ console.log('users no encontrada o error:', e.message); }
db.close();
