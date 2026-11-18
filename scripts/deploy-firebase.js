/**
 * scripts/deploy-firebase.js — Asistente automatizado de despliegue a Firebase Hosting (Next.js SSR)
 * Uso:
 *   npm run deploy:firebase -- --project tu-proyecto-firebase
 *   npm run deploy:firebase -- --project tu-proyecto-firebase --region us-central1 --dry-run
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function readArg(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return String(args[idx + 1]).trim();
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  return eq ? eq.slice(flag.length + 1).trim() : '';
}

const isDryRun = args.includes('--dry-run');
const requestedProject = readArg('--project') || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const requestedRegion = readArg('--region') || 'us-central1';

const firebasercPath = path.join(projectRoot, '.firebaserc');
const firebaseJsonPath = path.join(projectRoot, 'firebase.json');

function run(cmd, cmdArgs, options = {}) {
  return spawnSync(cmd, cmdArgs, {
    cwd: projectRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });
}

function getConfiguredProjectId() {
  if (requestedProject && requestedProject !== 'bunkker-local-app' && requestedProject !== 'tu-proyecto-firebase') {
    return requestedProject;
  }
  if (fs.existsSync(firebasercPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
      const def = parsed?.projects?.default;
      if (typeof def === 'string' && def.trim() && def !== 'tu-proyecto-firebase') {
        return def.trim();
      }
    } catch {
      // Ignorar .firebaserc malformado
    }
  }
  return '';
}

console.log('\n=== BUNKKER E.C.O.S — Despliegue Firebase Hosting ===');

if (!fs.existsSync(firebaseJsonPath)) {
  console.error('❌ No se encontro firebase.json en la raiz del proyecto.');
  process.exit(1);
}

const projectId = getConfiguredProjectId();
if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
  console.error('❌ Falta un Project ID de Firebase valido.');
  console.error('   Ejecuta: npm run deploy:firebase -- --project <tu-project-id>');
  process.exit(1);
}

if (!isDryRun) {
  fs.writeFileSync(
    firebasercPath,
    JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n',
    'utf8'
  );
  console.log(`✅ .firebaserc configurado para el proyecto: ${projectId} (region backend: ${requestedRegion})`);
}

const cliCheck = run('firebase', ['--version'], { capture: true });
if (cliCheck.status !== 0) {
  console.error('❌ Firebase CLI no detectado. Instala globalmente con: npm install -g firebase-tools');
  process.exit(1);
}
console.log(`✅ Firebase CLI detectado: ${(cliCheck.stdout || '').trim()}`);

if (isDryRun) {
  console.log(`🧪 [Dry Run] Listo para desplegar '${projectId}' -> https://${projectId}.web.app`);
  process.exit(0);
}

console.log('🔐 Verificando sesion activa en Firebase...');
const authCheck = run('firebase', ['projects:list', '--json'], { capture: true });
if (authCheck.status !== 0 && !process.env.FIREBASE_TOKEN && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('ℹ️ Sesion de Firebase CLI no iniciada. Abriendo login interactivo...');
  const loginRes = run('firebase', ['login']);
  if (loginRes.status !== 0) {
    console.error('❌ No se pudo iniciar sesion en Firebase. Ejecuta manualmente: firebase login');
    process.exit(loginRes.status || 1);
  }
}

console.log('⚙️ Habilitando soporte Next.js Web Frameworks en Firebase CLI...');
run('firebase', ['experiments:enable', 'webframeworks']);

console.log('🗄️ Generando cliente Prisma...');
const prismaGen = run('npx', ['prisma', 'generate']);
if (prismaGen.status !== 0) {
  process.exit(prismaGen.status || 1);
}

console.log(`🚀 Desplegando a Firebase Hosting (proyecto: ${projectId})...`);
const deployRes = run('firebase', ['deploy', '--only', 'hosting', '--project', projectId]);
if (deployRes.status !== 0) {
  console.error('\n❌ Fallo el despliegue a Firebase Hosting.');
  console.error('   Verifica que tu proyecto tenga facturacion Blaze activa si usa funciones SSR/API.');
  process.exit(deployRes.status || 1);
}

console.log('\n🎉 Despliegue completado en Firebase Hosting:');
console.log(`   URL principal:   https://${projectId}.web.app`);
console.log(`   URL alternativa: https://${projectId}.firebaseapp.com\n`);
