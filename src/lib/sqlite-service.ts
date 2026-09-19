/**
 * SQLITE SERVICE BRIDGE
 * Controlador inteligente que decide donde guardar los datos:
 * - Electron (.exe): usa SQLite local via electronAPI
 * - Navegador (PWA): usa IndexedDB local via idb-service
 * En ambos casos funciona 100% offline.
 */

import { idbGetAll, idbUpsert, enqueueSync } from './idb/idb-service';

function getActiveStoreId(): string {
    if (typeof window === 'undefined') return 'default';
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('s');
    if (fromUrl && fromUrl.length > 8) return fromUrl;
    return localStorage.getItem('_bunkker_active_store') ?? 'default';
}

export const localDB = {
    async getInventory() {
        // Electron: SQLite via IPC
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            return await (window as any).electronAPI.inventory.get();
        }
        // PWA/Navegador: IndexedDB local
        const storeId = getActiveStoreId();
        return await idbGetAll('products', storeId);
    },

    async syncProduct(product: any) {
        // Electron: SQLite via IPC
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            return await (window as any).electronAPI.inventory.save(product);
        }
        // PWA/Navegador: upsert en IndexedDB
        const storeId = getActiveStoreId();
        const record = { ...product, storeId, updatedAt: Date.now() };
        await idbUpsert('products', record);
        // Encolar para sincronizacion P2P cuando haya conexion
        await enqueueSync(storeId, 'PRODUCT_UPSERT', record);
        return record;
    },

    async processSale(cart: any[]) {
        // Electron: SQLite via IPC
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            const api = (window as any).electronAPI;
            const updates = cart.map(item =>
                api.inventory.updateStock(item.id, -item.quantity)
            );
            await Promise.all(updates);
            return { success: true };
        }
        // PWA/Navegador: guardar orden en IndexedDB
        const storeId = getActiveStoreId();
        const order = {
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
            storeId,
            items: cart.map(item => ({ productId: item.id, qty: item.quantity, price: item.price })),
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'completed' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await idbUpsert('orders', order);
        await enqueueSync(storeId, 'ORDER_COMPLETED', order);
        return { success: true, order };
    }
};

/**
 * Lógica de Sincronización Local (P2P):
 * Cuando una PC "Maestra" actualiza su SQLite, puede usar localSync.ts 
 * para emitir el cambio a las otras 4 PCs vía Wi-Fi.
 */
export async function broadcastLocalChange(type: string, payload: any) {
    // Aquí integramos con tu lógica de localSync.ts (WebSockets)
    // para que las otras ventanas/PCs se enteren del cambio en SQLite.
    console.log(`[P2P Sync] Difundiendo cambio de ${type} en red local.`);
}
