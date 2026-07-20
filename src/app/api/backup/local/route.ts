import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST() {
  try {
    // 1. Determinar rutas
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, error: 'Base de datos no encontrada.' }, { status: 404 });
    }

    // 2. Carpeta de destino (Documentos del usuario con fallback a local)
    let backupDir = path.join(os.homedir(), 'Documents', 'Backups_ERP');
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
    } catch (e) {
      // Fallback a carpeta dentro del proyecto si Documents falla por permisos o OneDrive
      backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
    }

    // 3. Generar nombre de archivo con fecha
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const backupFileName = `erp_db_backup_${dateStr}.sqlite`;
    const destinationPath = path.join(backupDir, backupFileName);

    // 4. Copiar archivo (bloquear lectura si es posible, pero copyFileSync es síncrono y rápido)
    fs.copyFileSync(dbPath, destinationPath);

    // Opcional: copiar tambien el archivo -wal si existe
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
       fs.copyFileSync(walPath, `${destinationPath}-wal`);
    }

    // 5. Limpieza de respaldos antiguos (mantener solo los últimos 10)
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('erp_db_backup_') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(path.join(backupDir, files[i].name));
        const oldWal = path.join(backupDir, files[i].name + '-wal');
        if (fs.existsSync(oldWal)) fs.unlinkSync(oldWal);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Respaldo creado exitosamente',
      path: destinationPath
    });

  } catch (error: any) {
    console.error('Error al respaldar DB:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
