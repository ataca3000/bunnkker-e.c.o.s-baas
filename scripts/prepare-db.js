/**
 * scripts/prepare-db.js — Preparación y sincronización de base de datos para despliegues Vercel / Nube
 * 
 * 1. Garantiza fallback de DIRECT_URL a DATABASE_URL para evitar el error Prisma P1012.
 * 2. Si se proporciona DATABASE_URL, empuja el esquema a PostgreSQL (prisma db push)
 *    para asegurar que todas las tablas existan antes de que Next.js compile.
 * 3. Ejecuta prisma/seed.js para asegurar catálogo de productos y usuarios de prueba.
 * 4. Si no se provee DATABASE_URL, permite el build usando el backend resiliente en memoria.
 */

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// 1. Resolver DIRECT_URL si falta
if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log('⚡ [DB Prep] DIRECT_URL no estaba definida. Se asignó automáticamente el valor de DATABASE_URL.');
}

// 2. Comprobar si hay base de datos remota
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.log('⚡ [DB Prep] No se detectó DATABASE_URL en el entorno.');
  console.log('ℹ️ [DB Prep] La aplicación compilará en modo demo con backend compatible en memoria.');
  process.exit(0);
}

console.log('🔄 [DB Prep] DATABASE_URL detectada. Sincronizando tablas en PostgreSQL...');

try {
  // Sincronizar modelos con la base de datos sin requerir migraciones manuales
  execSync('npx prisma db push --accept-data-loss', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL },
  });
  console.log('✅ [DB Prep] Tablas creadas/sincronizadas correctamente en la base de datos.');
} catch (err) {
  console.error('❌ [DB Prep] Error crítico al sincronizar tablas con prisma db push:');
  console.error(err.message || err);
  process.exit(1);
}

try {
  // Sembrar datos iniciales
  console.log('🌱 [DB Prep] Sembrando productos iniciales y usuarios de prueba...');
  execSync('node prisma/seed.js', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL },
  });
  console.log('✅ [DB Prep] Datos iniciales sembrados con éxito.');
} catch (err) {
  console.warn('⚠️ [DB Prep] Advertencia en prisma/seed.js:', err.message || err);
  // No bloquear el build si las filas ya existían
}
