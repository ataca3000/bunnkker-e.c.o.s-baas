import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * atomicWriteFileSync — Escritura Atómica Resistente a Apagones (Kernel Atomic Rename + Fsync)
 * 
 * 1. Escribe los datos en un archivo temporal con sufijo .tmp
 * 2. Ejecuta fs.fsyncSync(fd) obligando al disco SSD/HDD a vaciar el búfer de caché físico.
 * 3. Ejecuta fs.renameSync(temp, dest) que en sistemas NTFS y POSIX es una operación
 *    atómica del kernel: jamás produce archivos de 0 bytes o truncados a la mitad.
 * 4. Si el directorio es de solo lectura (ej. /var/task en Vercel Serverless),
 *    redirige de forma transparente a os.tmpdir() (/tmp) sin romper la ejecución.
 */
export function resolveWritablePath(targetPath: string): string {
    const dir = path.dirname(targetPath);
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return targetPath;
    } catch {
        // Fallback para entornos Serverless de solo lectura (Vercel / AWS Lambda)
        const fallbackDir = path.join(os.tmpdir(), 'bunnkker-ecos');
        try {
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
        } catch {
            // Ignorar si /tmp ya existe
        }
        return path.join(fallbackDir, path.basename(targetPath));
    }
}

export function atomicWriteFileSync(filePath: string, data: string | Buffer, createBackup = false): void {
    const safeFilePath = resolveWritablePath(filePath);
    const tempPath = `${safeFilePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    // 1. Escribir y forzar vaciado a disco físico (fsync)
    const fd = fs.openSync(tempPath, 'w');
    try {
        if (typeof data === 'string') {
            fs.writeSync(fd, data, 0, 'utf-8');
        } else {
            fs.writeSync(fd, data, 0, data.length);
        }
        try {
            fs.fsyncSync(fd); // Garantiza que los bytes se graben en la memoria flash física
        } catch {
            // Algunos sistemas de archivos virtuales en contenedores no soportan fsync en /tmp
        }
    } finally {
        fs.closeSync(fd);
    }

    // 2. Rotación previa si existe archivo previo y se solicita backup
    if (createBackup && fs.existsSync(safeFilePath)) {
        try {
            const bakPath = `${safeFilePath}.bak`;
            fs.copyFileSync(safeFilePath, bakPath);
        } catch {
            // Ignorar error no crítico de rotación secundaria
        }
    }

    // 3. Renombramiento atómico
    fs.renameSync(tempPath, safeFilePath);
}
