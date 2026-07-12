const Database = require('better-sqlite3');
const db = new (require('better-sqlite3'))('./prisma/dev.db', { readonly: true });
console.log('Tablas:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
try {
  const r = db.prepare("SELECT count(*) as c FROM User").get();
  console.log('User count:', r ? r.c : 'tabla User no encontrada');
} catch(e) {
  console.log('Error consultando User:', e.message);
}
db.close();
