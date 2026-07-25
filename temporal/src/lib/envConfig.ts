export type AppEnvironment = 'demo' | 'local' | 'nube';

/**
 * Retorna el entorno actual en el que se compiló o se está ejecutando la aplicación.
 * demo: Landing page pública para captar leads y descargar el .exe
 * local: Ejecutable .exe offline (sin mapas, ni IA en la nube, SQLite puro)
 * nube: Ecosistema PRO desplegado en Firebase (APIs de Google activas, Red B2B)
 */
export function getAppEnv(): AppEnvironment {
    // Si no está definido (por ejemplo, en 'npm run dev'), asumimos 'local' para no generar costos.
    return (process.env.NEXT_PUBLIC_APP_ENV as AppEnvironment) || 'local';
}

export const isDemo = () => getAppEnv() === 'demo';
export const isLocal = () => getAppEnv() === 'local';
export const isNube = () => getAppEnv() === 'nube';
