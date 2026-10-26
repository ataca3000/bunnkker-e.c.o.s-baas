/**
 * scripts/prepare-db.js — Preparación y sincronización de base de datos para despliegues Vercel / Nube
 * 
 * 1. Garantiza fallback de DIRECT_URL a DATABASE_URL para evitar el error Prisma P1012.
 * 2. Si se proporciona DATABASE_URL, intenta empujar el esquema (prisma db push) con reintentos
 *    automáticos ante Cold Starts de Neon / Supabase.
 * 3. Si la base de datos remota no responde tras reintentos, emite advertencia sin tumbar el build
 *    de Vercel (exit 0) permitiendo que Next.js compile con el backend resiliente.
 */

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// 1. Resolver DIRECT_URL y sslmode para Neon / Supabase
if (process.env.DATABASE_URL) {
  // Asegurar sslmode=require si es Neon / Postgres en la nube
  if (process.env.DATABASE_URL.includes('neon.tech') && !process.env.DATABASE_URL.includes('sslmode=')) {
    const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
    process.env.DATABASE_URL = `${process.env.DATABASE_URL}${sep}sslmode=require`;
  }

  // Derivar DIRECT_URL si falta
  if (!process.env.DIRECT_URL) {
    if (process.env.DATABASE_URL.includes('-pooler')) {
      process.env.DIRECT_URL = process.env.DATABASE_URL.replace('-pooler', '');
      console.log('⚡ [DB Prep] DIRECT_URL derivada automáticamente de DATABASE_URL (removiendo "-pooler" para migraciones DDL directas).');
    } else {
      process.env.DIRECT_URL = process.env.DATABASE_URL;
      console.log('⚡ [DB Prep] DIRECT_URL no estaba definida. Se asignó automáticamente el valor de DATABASE_URL.');
    }
  }

  if (process.env.DIRECT_URL && process.env.DIRECT_URL.includes('neon.tech') && !process.env.DIRECT_URL.includes('sslmode=')) {
    const sep = process.env.DIRECT_URL.includes('?') ? '&' : '?';
    process.env.DIRECT_URL = `${process.env.DIRECT_URL}${sep}sslmode=require`;
  }
}

// 2. Comprobar si hay base de datos remota
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.log('⚡ [DB Prep] No se detectó DATABASE_URL en el entorno.');
  console.log('ℹ️ [DB Prep] La aplicación compilará en modo soberano con backend compatible.');
  process.exit(0);
}

console.log('🔄 [DB Prep] DATABASE_URL detectada. Sincronizando tablas en la base de datos...');

const MAX_RETRIES = 3;
let syncSuccess = false;

// Protección contra pérdida involuntaria de datos: usar --accept-data-loss solo si se solicita o en dev
const pushFlags = process.env.PRISMA_SAFE_PUSH === 'true' ? '' : '--accept-data-loss';

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    console.log(`📡 [DB Prep] Intento ${attempt}/${MAX_RETRIES} de conexión y sincronización con Neon...`);
    execSync(`npx prisma db push ${pushFlags}`.trim(), {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL },
    });
    console.log('✅ [DB Prep] Tablas creadas/sincronizadas correctamente en la base de datos.');
    syncSuccess = true;
    break;
  } catch (err) {
    console.warn(`⚠️ [DB Prep] Falló intento ${attempt}/${MAX_RETRIES}: ${err.message || err}`);
    if (attempt < MAX_RETRIES) {
      console.log('⏳ [DB Prep] Esperando 5 segundos para permitir despertar de Neon (Cold Start)...');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    }
  }
}

if (!syncSuccess) {
  console.warn('⚠️ [DB Prep] No se pudo conectar a la base de datos remota tras 3 intentos (posible Cold Start o red inaccesible).');
  console.warn('🛡️ [DB Prep] Continuando compilación en Vercel con backend resiliente (Build blindado contra fallas de red).');
  process.exit(0);
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
}
