/**
 * SQLITE SERVICE BRIDGE
 * Controlador inteligente que decide dónde guardar los datos.
 * Si estamos en el .exe de Electron, usa SQLite local para 100% offline.
 */

export const localDB = {
    async getInventory() {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            return await (window as any).electronAPI.inventory.get();
        }
        // Fallback si se usa en navegador normal (puedes retornar el cache de Firebase aquí)
        return [];
    },

    async syncProduct(product: any) {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            return await (window as any).electronAPI.inventory.save(product);
        }
    },

    async processSale(cart: any[]) {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            const api = (window as any).electronAPI;
            
            // Actualizar stock localmente de forma atómica en SQLite
            const updates = cart.map(item => 
                api.inventory.updateStock(item.id, -item.quantity)
            );
            
            await Promise.all(updates);
            return { success: true };
        }
        return { success: false };
    }
};

import { unifiedSync } from './unifiedSyncEngine';

/**
 * Lógica de Sincronización Local (P2P):
 * Cuando una PC "Maestra" actualiza su SQLite, usa unifiedSyncEngine
 * para emitir el cambio a la red LAN (vía WebSockets) o a la nube.
 */
export async function broadcastLocalChange(type: string, payload: any) {
    console.log(`[P2P Sync] Difundiendo cambio de ${type} vía UnifiedSyncEngine.`);
    unifiedSync.enqueue({ type, data: payload });
}
