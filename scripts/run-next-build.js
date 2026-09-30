const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const [buildTarget = 'web', appEnv = 'nube'] = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '..');
const nextBin = require.resolve('next/dist/bin/next', { paths: [projectRoot] });

// Si estamos compilando para escritorio local (Electron .exe), Prisma DEBE usar SQLite local, no PostgreSQL.
const isLocalDesktop = buildTarget === 'desktop' || appEnv === 'local';
const schemaPostgresPath = path.join(projectRoot, 'prisma', 'schema.prisma');
const schemaSqlitePath = path.join(projectRoot, 'prisma', 'schema.sqlite.prisma');
const schemaBackupPath = path.join(projectRoot, 'prisma', 'schema.prisma.bak');

if (isLocalDesktop && fs.existsSync(schemaSqlitePath)) {
  console.log('⚡ [Build Desktop] Activando schema SQLite para ejecutable 100% offline...');
  fs.copyFileSync(schemaPostgresPath, schemaBackupPath);
  fs.copyFileSync(schemaSqlitePath, schemaPostgresPath);
  spawnSync('npx', ['prisma', 'generate'], { cwd: projectRoot, stdio: 'inherit', shell: true });
}

let buildStatus = 0;
try {
  const serverDir = path.join(projectRoot, '.next', 'server');
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }
  const pagesDir = path.join(serverDir, 'pages');
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }
  const edgeFile = path.join(serverDir, 'edge-runtime-webpack.js');
  if (!fs.existsSync(edgeFile)) {
    fs.writeFileSync(edgeFile, '// Placeholder for Next.js build tracer\nmodule.exports = {};\n');
  }

  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BUILD_TARGET: buildTarget,
      NEXT_PUBLIC_APP_ENV: appEnv,
      INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=6144',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
    shell: false,
  });
  buildStatus = result.status ?? 0;
} finally {
  // Siempre restaurar el schema de PostgreSQL original para Vercel / Web
  if (isLocalDesktop && fs.existsSync(schemaBackupPath)) {
    fs.copyFileSync(schemaBackupPath, schemaPostgresPath);
    fs.unlinkSync(schemaBackupPath);
    console.log('🔄 [Build Desktop] Schema PostgreSQL restaurado para la web.');
  }
}

if (buildStatus !== 0) {
  process.exit(buildStatus);
}
