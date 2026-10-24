/**
 * imageCompression.ts — Compresión Client-Side a WebP con Canvas
 * 
 * Reduce imágenes de celulares (3MB - 10MB) a WebP optimizado de ~25KB - 40KB
 * antes de transmitirlas a la base de datos o API.
 */

export async function compressImageToWebP(
    imageSource: string | File | Blob,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.75,
    watermarkText?: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Mantener proporción de aspecto
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(typeof imageSource === 'string' ? imageSource : '');
                return;
            }

            // Fondo limpio
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            // Dibujar imagen reescalada
            ctx.drawImage(img, 0, 0, width, height);

            // Marca de agua forense si se proporciona
            if (watermarkText) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(0, height - 32, width, 32);

                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(watermarkText, 10, height - 12);
            }

            // Exportar a WebP con fallback a JPEG
            try {
                const webpData = canvas.toDataURL('image/webp', quality);
                if (webpData.startsWith('data:image/webp')) {
                    resolve(webpData);
                    return;
                }
            } catch {
                // Fallback a JPEG
            }

            const jpegData = canvas.toDataURL('image/jpeg', quality);
            resolve(jpegData);
        };

        img.onerror = (err) => {
            console.warn('[imageCompression] Error cargando imagen para compresión:', err);
            if (typeof imageSource === 'string') resolve(imageSource);
            else reject(err);
        };

        if (typeof imageSource === 'string') {
            img.src = imageSource;
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageSource);
        }
    });
}
