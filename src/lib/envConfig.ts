export type AppEnvironment = 'demo' | 'local' | 'nube';

/**
 * Retorna el entorno actual en el que se compiló o se está ejecutando la aplicación.
 * demo: Landing page pública para captar leads y descargar el .exe
 * local: Ejecutable .exe offline (sin mapas, ni IA en la nube, SQLite puro)
 * nube: Ecosistema PRO desplegado en Firebase (APIs de Google activas, Red B2B)
 */
export function getAppEnv(): AppEnvironment {
    if (process.env.NEXT_PUBLIC_APP_ENV) {
        return process.env.NEXT_PUBLIC_APP_ENV as AppEnvironment;
    }
    // Si corre en Vercel y no se especificó variable de entorno, el default seguro es 'demo'
    if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) {
        return 'demo';
    }
    // Si no está definido (por ejemplo, en 'npm run dev'), asumimos 'local' para no generar costos.
    return 'local';
}

export const isDemo = () => getAppEnv() === 'demo';
export const isLocal = () => getAppEnv() === 'local';
export const isNube = () => getAppEnv() === 'nube';
