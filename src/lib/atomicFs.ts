import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * atomicWriteFileSync — Escritura Atómica Resistente a Apagones (Kernel Atomic Rename + Fsync)
 * 
 * 1. Escribe los datos en un archivo temporal con sufijo .tmp
 * 2. Ejecuta fs.fsyncSync(fd) obligando al disco SSD/HDD a vaciar el búfer de caché físico.
 * 3. Ejecuta fs.renameSync(temp, dest) que en sistemas NTFS y POSIX es una operación
 *    atómica del kernel: jamás produce archivos de 0 bytes o truncados a la mitad.
 * 4. Blindado contra entornos de solo lectura (Vercel Serverless / EROFS) con fallback a os.tmpdir().
 */
export function atomicWriteFileSync(filePath: string, data: string | Buffer, createBackup = false): string {
    let targetPath = filePath;
    let dir = path.dirname(targetPath);

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch {
        // Fallback para entornos Serverless de solo lectura (Vercel EROFS)
        const baseName = path.basename(filePath);
        dir = path.join(os.tmpdir(), 'bunnkker-ecos');
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch {
            dir = os.tmpdir();
        }
        targetPath = path.join(dir, baseName);
    }

    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    // 1. Escribir y forzar vaciado a disco físico (fsync)
    const fd = fs.openSync(tempPath, 'w');
    try {
        if (typeof data === 'string') {
            fs.writeSync(fd, data, 0, 'utf-8');
        } else {
            fs.writeSync(fd, data, 0, data.length);
        }
        try {
            fs.fsyncSync(fd);
        } catch {
            // Algunos sistemas de archivos virtuales o en memoria no soportan fsync
        }
    } finally {
        fs.closeSync(fd);
    }

    // 2. Rotación previa si existe archivo previo y se solicita backup
    if (createBackup && fs.existsSync(targetPath)) {
        try {
            const bakPath = `${targetPath}.bak`;
            fs.copyFileSync(targetPath, bakPath);
        } catch {
            // Ignorar error no crítico de rotación secundaria
        }
    }

    // 3. Renombramiento atómico
    fs.renameSync(tempPath, targetPath);
    return targetPath;
}
