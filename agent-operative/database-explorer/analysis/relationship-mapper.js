'use strict';

/**
 * Construye el grafo de relaciones entre tablas (salientes, entrantes, enlaces lógicos).
 */
function mapRelationships(tables, relations, columnsByTable) {
  const outboundByTable = {};
  const inboundByTable = {};

  for (const table of tables) {
    outboundByTable[table.name] = [];
    inboundByTable[table.name] = [];
  }

  for (const rel of relations) {
    if (!outboundByTable[rel.fromTable]) outboundByTable[rel.fromTable] = [];
    if (!inboundByTable[rel.toTable]) inboundByTable[rel.toTable] = [];

    outboundByTable[rel.fromTable].push({
      column: rel.fromColumn,
      targetTable: rel.toTable,
      targetColumn: rel.toColumn,
      onDelete: rel.onDelete,
      onUpdate: rel.onUpdate,
    });

    inboundByTable[rel.toTable].push({
      sourceTable: rel.fromTable,
      sourceColumn: rel.fromColumn,
      column: rel.toColumn,
      onDelete: rel.onDelete,
      onUpdate: rel.onUpdate,
    });
  }

  // Enlaces semánticos implícitos comunes en BUNKKER (tenantId / userId / actorId / productId / vendedorId)
  // que existen aunque SQLite no declare FK física estricta por flexibilidad offline.
  const logicalLinks = [];
  const tableNames = new Set(tables.map((t) => t.name));

  for (const table of tables) {
    const cols = columnsByTable[table.name] || [];
    for (const col of cols) {
      if (col.name === 'userId' || col.name === 'actorId' || col.name === 'vendedorId' || col.name === 'cashierId' || col.name === 'assignedDriverId') {
        if (tableNames.has('User')) {
          logicalLinks.push({
            fromTable: table.name,
            fromColumn: col.name,
            toTable: 'User',
            toColumn: 'id',
            kind: 'semantic_actor_ref',
          });
        }
      } else if (col.name === 'productId') {
        const hasPhysicalFk = (outboundByTable[table.name] || []).some(
          (fk) => fk.column === 'productId' && fk.targetTable === 'Product'
        );
        if (!hasPhysicalFk && tableNames.has('Product')) {
          logicalLinks.push({
            fromTable: table.name,
            fromColumn: col.name,
            toTable: 'Product',
            toColumn: 'id',
            kind: 'semantic_product_ref',
          });
        }
      } else if (col.name === 'orderId') {
        const hasPhysicalFk = (outboundByTable[table.name] || []).some(
          (fk) => fk.column === 'orderId' && fk.targetTable === 'Order'
        );
        if (!hasPhysicalFk && tableNames.has('Order')) {
          logicalLinks.push({
            fromTable: table.name,
            fromColumn: col.name,
            toTable: 'Order',
            toColumn: 'id',
            kind: 'semantic_order_ref',
          });
        }
      }
    }
  }

  const auditCorrelationChains = [
    {
      name: 'Auditoría de Venta Cancelada o Sospechosa',
      steps: [
        'Order (status, total, rejectionReason, vendedorId, confirmedAt)',
        'User (actorId/vendedorId -> role, active)',
        'OrderEvent (orderId -> secuencia fromStatus/toStatus y actorRole)',
        'OrderItem -> Product (productId -> cantidad, precio vs Product.price, stock/reservedStock)',
        'CashRegisterLog (cashierId -> discrepancias en corte)',
        'AuditLog (userId, action=ORDER_CANCELLED|PRICE_CHANGE|SECURITY_ALERT)',
      ],
    },
    {
      name: 'Trazabilidad de Inventario y Merma',
      steps: [
        'Product (stock, reservedStock, barcode, deletedAt)',
        'OrderItem (salidas comprometidas o liquidadas)',
        'ShrinkageLog (productId -> discrepancyType, qty, estimatedLoss, reportedBy)',
        'Purchase (reposición por proveedor y costo)',
        'AuditLog (action=STOCK_UPDATE|INVENTORY_MOVE|SHRINKAGE)',
      ],
    },
  ];

  return {
    outboundByTable,
    inboundByTable,
    logicalLinks,
    auditCorrelationChains,
  };
}

module.exports = {
  mapRelationships,
};
