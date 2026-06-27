const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const appDir = path.join(rootDir, 'apps', 'admin-com-erp');
const coreDir = path.join(rootDir, 'packages', 'bunkker-core', 'src');

// 1. Mover archivos de lib a core
const libDir = path.join(appDir, 'src', 'lib');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const stat = fs.lstatSync(path.join(from, element));
        if (stat.isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

console.log("Copiando src/lib a @bunkker/core/src...");
copyFolderSync(libDir, coreDir);

// Crear un index.ts exportador en coreDir
let indexContent = '';
fs.readdirSync(coreDir).forEach(file => {
    if (file.endsWith('.ts') && file !== 'index.ts' && file !== 'check-ports.js' && file !== 'validate-comm.js') {
        const baseName = file.replace('.ts', '');
        indexContent += `export * from './${baseName}';\n`;
    }
});
// también exportar AI
if (fs.existsSync(path.join(coreDir, 'ai'))) {
    indexContent += `export * from './ai/classifyProduct';\n`;
    indexContent += `export * from './ai/productClassifier';\n`;
}

fs.writeFileSync(path.join(coreDir, 'index.ts'), indexContent);

// 2. Actualizar el package.json de la app para incluir el core
const appPkgPath = path.join(appDir, 'package.json');
const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
appPkg.dependencies = appPkg.dependencies || {};
appPkg.dependencies['@bunkker/core'] = '*';
appPkg.name = 'admin-com-erp';
fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

// 3. Buscar y reemplazar imports en toda la app
function replaceInFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInFiles(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            
            // Reemplazos de imports directos
            const regex = /from\s+['"]@\/lib\/(.*?)['"]/g;
            content = content.replace(regex, (match, p1) => {
                changed = true;
                // Si importa especificamente de @/lib/archivo
                return `from '@bunkker/core'`;
            });
            
            // Reemplazo generico @/lib a @bunkker/core
            if (content.includes("from '@/lib'")) {
                content = content.replace(/from\s+['"]@\/lib['"]/g, "from '@bunkker/core'");
                changed = true;
            }

            if (changed) {
                // Eliminar posibles importaciones duplicadas del core en el mismo archivo (limpieza básica)
                // Se confía en el bundler, pero evitamos errores de sintaxis si hay multiples exportaciones iguales.
                // En TS, importar varias veces de la misma ruta está permitido.
                fs.writeFileSync(fullPath, content);
            }
        }
    }
}

console.log("Refactorizando imports en la aplicación...");
replaceInFiles(path.join(appDir, 'src'));

console.log("Migración completada con éxito.");
