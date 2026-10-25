import { describe, it, expect } from 'vitest';

describe('Organismo Único - Aislamiento Estricto de Perspectivas por Rol', () => {

  const evaluateRolePerspective = (role: string) => {
    const rawRole = (role || 'superadmin').toLowerCase();
    const isAlmacen = ['inventory', 'almacen', 'bodega'].includes(rawRole);
    const isCaja = ['sales', 'billing', 'caja'].includes(rawRole);
    const isCarga = ['carga_descarga', 'patio', 'carga'].includes(rawRole);
    const isPickup = ['pickup', 'mostrador'].includes(rawRole);
    const isChofer = ['driver', 'repartidor', 'chofer'].includes(rawRole);
    const isSuperAdmin = ['superadmin', 'admin'].includes(rawRole);

    return {
      canAccessDriverCockpit: isChofer,
      canAccessSuperAdminMaster: isSuperAdmin,
      canAccessWarehouseInventoryAndPrices: isAlmacen,
      canAccessCashierCollectionQueue: isCaja,
      canAccessStoreFosa: isAlmacen || isCaja || isCarga || isPickup,
      canCollectMoney: isCaja, // Regla estricta: Solo Caja cobra
      canModifyPrices: isAlmacen // Regla estricta: Solo Almacén fija precios
    };
  };

  it('Chofer / Repartidor solo tiene acceso a su consola soberana y NUNCA a cobro ni precios', () => {
    const driverPerms = evaluateRolePerspective('driver');
    expect(driverPerms.canAccessDriverCockpit).toBe(true);
    expect(driverPerms.canAccessSuperAdminMaster).toBe(false);
    expect(driverPerms.canAccessCashierCollectionQueue).toBe(false);
    expect(driverPerms.canAccessWarehouseInventoryAndPrices).toBe(false);
    expect(driverPerms.canCollectMoney).toBe(false);
    expect(driverPerms.canModifyPrices).toBe(false);
  });

  it('Caja solo tiene acceso a fosa de tienda y cola de cobro, NUNCA a modificar precios', () => {
    const cashierPerms = evaluateRolePerspective('sales');
    expect(cashierPerms.canAccessCashierCollectionQueue).toBe(true);
    expect(cashierPerms.canAccessStoreFosa).toBe(true);
    expect(cashierPerms.canCollectMoney).toBe(true);
    expect(cashierPerms.canModifyPrices).toBe(false);
    expect(cashierPerms.canAccessWarehouseInventoryAndPrices).toBe(false);
    expect(cashierPerms.canAccessSuperAdminMaster).toBe(false);
    expect(cashierPerms.canAccessDriverCockpit).toBe(false);
  });

  it('Almacén tiene gobernanza exclusiva de precios y stock, NUNCA cobra', () => {
    const warehousePerms = evaluateRolePerspective('inventory');
    expect(warehousePerms.canAccessWarehouseInventoryAndPrices).toBe(true);
    expect(warehousePerms.canModifyPrices).toBe(true);
    expect(warehousePerms.canAccessStoreFosa).toBe(true);
    expect(warehousePerms.canCollectMoney).toBe(false);
    expect(warehousePerms.canAccessCashierCollectionQueue).toBe(false);
    expect(warehousePerms.canAccessSuperAdminMaster).toBe(false);
    expect(warehousePerms.canAccessDriverCockpit).toBe(false);
  });

  it('Patio (Carga) y Pickup participan en fosa y recolección, pero NUNCA cobran', () => {
    const patioPerms = evaluateRolePerspective('carga_descarga');
    const pickupPerms = evaluateRolePerspective('pickup');

    expect(patioPerms.canAccessStoreFosa).toBe(true);
    expect(patioPerms.canCollectMoney).toBe(false);
    expect(patioPerms.canModifyPrices).toBe(false);
    expect(patioPerms.canAccessSuperAdminMaster).toBe(false);

    expect(pickupPerms.canAccessStoreFosa).toBe(true);
    expect(pickupPerms.canCollectMoney).toBe(false);
    expect(pickupPerms.canModifyPrices).toBe(false);
    expect(pickupPerms.canAccessSuperAdminMaster).toBe(false);
  });

  it('SuperAdmin accede a la vista ejecutiva maestra sin ser tratado como cajero u operario de piso', () => {
    const adminPerms = evaluateRolePerspective('superadmin');
    expect(adminPerms.canAccessSuperAdminMaster).toBe(true);
    expect(adminPerms.canAccessDriverCockpit).toBe(false);
  });

  it('Filtro de Fosa para Chofer: solo pedidos con pago confirmado y destino DELIVERY', () => {
    const ordersMock = [
      { id: 'ORD-1', status: 'pending_payment', deliveryType: 'LOCAL', confirmedAt: null },
      { id: 'ORD-2', status: 'paid', deliveryType: 'LOCAL', confirmedAt: '2026-10-25T12:00:00Z' },
      { id: 'ORD-3', status: 'pending_payment', deliveryType: 'DELIVERY', confirmedAt: null }, // NO pagado aún
      { id: 'ORD-4', status: 'paid', deliveryType: 'DELIVERY', confirmedAt: '2026-10-25T12:05:00Z' }, // PAGADO para chofer
    ];

    // Regla de Oro de Chofer: Solo pedidos ya pagados con destino domicilio
    const driverEligibleOrders = ordersMock.filter(o => 
      o.deliveryType === 'DELIVERY' && Boolean(o.confirmedAt || o.status === 'paid')
    );

    expect(driverEligibleOrders.length).toBe(1);
    expect(driverEligibleOrders[0].id).toBe('ORD-4');
  });

});
