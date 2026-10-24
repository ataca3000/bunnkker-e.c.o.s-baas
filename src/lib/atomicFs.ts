import fs from 'fs';
import path from 'path';

/**
 * atomicWriteFileSync — Escritura Atómica Resistente a Apagones (Kernel Atomic Rename + Fsync)
 * 
 * 1. Escribe los datos en un archivo temporal con sufijo .tmp
 * 2. Ejecuta fs.fsyncSync(fd) obligando al disco SSD/HDD a vaciar el búfer de caché físico.
 * 3. Ejecuta fs.renameSync(temp, dest) que en sistemas NTFS y POSIX es una operación
 *    atómica del kernel: jamás produce archivos de 0 bytes o truncados a la mitad.
 * 4. Opcionalmente genera un respaldo de rotación (.bak).
 */
export function atomicWriteFileSync(filePath: string, data: string | Buffer, createBackup = false): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    // 1. Escribir y forzar vaciado a disco físico (fsync)
    const fd = fs.openSync(tempPath, 'w');
    try {
        if (typeof data === 'string') {
            fs.writeSync(fd, data, 0, 'utf-8');
        } else {
            fs.writeSync(fd, data, 0, data.length);
        }
        fs.fsyncSync(fd); // Garantiza que los bytes se graben en la memoria flash física
    } finally {
        fs.closeSync(fd);
    }

    // 2. Rotación previa si existe archivo previo y se solicita backup
    if (createBackup && fs.existsSync(filePath)) {
        try {
            const bakPath = `${filePath}.bak`;
            fs.copyFileSync(filePath, bakPath);
        } catch {
            // Ignorar error no crítico de rotación secundaria
        }
    }

    // 3. Renombramiento atómico
    fs.renameSync(tempPath, filePath);
}
