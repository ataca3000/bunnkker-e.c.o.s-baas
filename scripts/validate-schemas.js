/**
 * BUNKKER E.C.O.S. — Validador de Divergencia entre Schemas Prisma
 * ─────────────────────────────────────────────────────────────────
 * Compara los modelos definidos en schema.prisma (PostgreSQL/cloud)
 * vs schema.sqlite.prisma (SQLite/local) y reporta diferencias.
 *
 * USO:
 *   node scripts/validate-schemas.js
 *
 * INTEGRACIÓN:
 *   Agregar a CI o como hook pre-build para detectar divergencias.
 * ─────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_CLOUD  = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const SCHEMA_LOCAL  = path.join(__dirname, '..', 'prisma', 'schema.sqlite.prisma');

function extractModels(content) {
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  const models = {};
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1];
    // Extraer campos (líneas que no son directivas @ o comentarios vacíos)
    const fields = match[2]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('@'))
      .map(l => l.split(/\s+/).slice(0, 2).join(' ')); // "fieldName Type"
    models[name] = fields;
  }
  return models;
}

function main() {
  console.log('🔍 BUNKKER — Validando divergencia entre schemas Prisma\n');

  if (!fs.existsSync(SCHEMA_CLOUD)) {
    console.error('❌ No se encuentra schema.prisma');
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_LOCAL)) {
    console.error('❌ No se encuentra schema.sqlite.prisma');
    process.exit(1);
  }

  const cloudContent = fs.readFileSync(SCHEMA_CLOUD, 'utf8');
  const localContent = fs.readFileSync(SCHEMA_LOCAL, 'utf8');

  const cloudModels = extractModels(cloudContent);
  const localModels = extractModels(localContent);

  const cloudNames = new Set(Object.keys(cloudModels));
  const localNames = new Set(Object.keys(localModels));

  let issues = 0;

  // Modelos en cloud pero no en local
  for (const name of cloudNames) {
    if (!localNames.has(name)) {
      console.warn(`⚠️  Modelo "${name}" existe en PostgreSQL pero NO en SQLite`);
      issues++;
    }
  }

  // Modelos en local pero no en cloud
  for (const name of localNames) {
    if (!cloudNames.has(name)) {
      console.warn(`⚠️  Modelo "${name}" existe en SQLite pero NO en PostgreSQL`);
      issues++;
    }
  }

  // Campos divergentes en modelos compartidos
  for (const name of cloudNames) {
    if (!localNames.has(name)) continue;
    const cloudFields = new Set(cloudModels[name]);
    const localFields = new Set(localModels[name]);

    for (const f of cloudFields) {
      if (!localFields.has(f)) {
        console.warn(`⚠️  [${name}] Campo "${f}" en PostgreSQL pero NO en SQLite`);
        issues++;
      }
    }
    for (const f of localFields) {
      if (!cloudFields.has(f)) {
        console.warn(`⚠️  [${name}] Campo "${f}" en SQLite pero NO en PostgreSQL`);
        issues++;
      }
    }
  }

  if (issues === 0) {
    console.log('✅ Schemas sincronizados. Sin divergencias detectadas.');
    process.exit(0);
  } else {
    console.log(`\n❌ Se encontraron ${issues} divergencia(s). Sincronizar antes de deploy.`);
    process.exit(1);
  }
}

main();
