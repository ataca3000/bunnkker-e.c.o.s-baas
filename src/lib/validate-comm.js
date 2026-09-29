/**
 * Script de Validación de Comunicación (Electron <-> Next.js)
 * Este script verifica la disponibilidad de servicios y la integridad del puente IPC.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

async function validate() {
  console.log(`${COLORS.cyan}=== DIAGNÓSTICO DE COMUNICACIÓN ADMIN.COM ===${COLORS.reset}\n`);

  // 1. Verificar Estructura de Archivos del Puente
  console.log(`[1/4] Verificando archivos del puente IPC...`);
  const files = ['electron-main.js', 'preload.js'];
  files.forEach(f => {
    const fullPath = path.join(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      console.log(`  ${COLORS.green}✓${COLORS.reset} ${f} detectado.`);
    } else {
      console.log(`  ${COLORS.red}✗${COLORS.reset} NO SE ENCONTRÓ ${f}. El puente IPC no funcionará.`);
    }
  });

  // 2. Verificar disponibilidad de Next.js
  console.log(`\n[2/4] Verificando servidor Next.js (Renderer)...`);
  await new Promise(resolve => {
    const req = http.get('http://localhost:3000', (res) => {
      console.log(`  ${COLORS.green}✓${COLORS.reset} Next.js activo en puerto 3000.`);
      resolve(true);
    });
    req.on('error', () => {
      console.log(`  ${COLORS.yellow}⚠${COLORS.reset} Next.js no responde en puerto 3000. (Ejecuta 'npm run dev' primero)`);
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });

  // 3. Verificar Entorno Electron
  console.log(`\n[3/4] Verificando binario de Electron...`);
  try {
    const version = execSync('npx electron --version', { stdio: 'pipe' }).toString().trim();
    console.log(`  ${COLORS.green}✓${COLORS.reset} Electron ${version} está listo para usarse.`);
  } catch (e) {
    console.log(`  ${COLORS.red}✗${COLORS.reset} Error al invocar Electron. Revisa tus devDependencies.`);
  }

  // 4. Verificar Contrato Preload
  const preloadPath = path.join(process.cwd(), 'preload.js');
  if (fs.existsSync(preloadPath)) {
    const content = fs.readFileSync(preloadPath, 'utf8');
    if (content.includes('contextBridge') && content.includes('electronAPI')) {
      console.log(`\n[4/4] ${COLORS.green}✓ Puente contextBridge expuesto correctamente.${COLORS.reset}`);
    } else {
      console.log(`\n[4/4] ${COLORS.yellow}⚠ Advertencia: preload.js no parece exponer 'electronAPI'.${COLORS.reset}`);
    }
  }

  console.log(`\n${COLORS.cyan}=============================================${COLORS.reset}`);
  console.log(`Para probar el puente en vivo, ejecuta: ${COLORS.green}npm run dev:electron${COLORS.reset}`);
  console.log(`${COLORS.cyan}=============================================${COLORS.reset}\n`);
}

validate();