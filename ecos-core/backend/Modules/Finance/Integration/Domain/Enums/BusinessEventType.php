<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Enums;

/**
 * The catalog of business events the Finance OS recognises.
 *
 * ┌─ THE CONTRACT BETWEEN OPERATIONS AND FINANCE ───────────────────────────┐
 * │ Operational modules are the operational system of record; Finance is the  │
 * │ financial system of record. The bridge is a named business event. Each    │
 * │ code below maps to a configurable Posting Rule; an event with no rule has  │
 * │ no financial impact (a reservation, an order confirmation) and is recorded │
 * │ in the audit as "skipped" — deliberately, not by omission.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum BusinessEventType: string
{
    // ── Inventory ───────────────────────────────────────────────────────────────
    case GoodsReceipt = 'inventory.goods_receipt';
    case SupplierReturn = 'inventory.supplier_return';
    case WarehouseTransfer = 'inventory.warehouse_transfer';
    case InventoryAdjustmentIncrease = 'inventory.adjustment_increase';
    case InventoryAdjustmentDecrease = 'inventory.adjustment_decrease';
    case InventoryCountGain = 'inventory.count_gain';
    case InventoryCountLoss = 'inventory.count_loss';
    case InventoryWriteOff = 'inventory.write_off';

    // ── Procurement ─────────────────────────────────────────────────────────────
    case PurchaseRequest = 'procurement.purchase_request';        // commitment — no GL
    case PurchaseMaterials = 'procurement.purchase_materials';    // supplier invoice (accrual clear + VAT)
    case PurchaseReturn = 'procurement.purchase_return';

    // ── Manufacturing ───────────────────────────────────────────────────────────
    case MaterialConsumption = 'manufacturing.material_consumption';
    case BomConsumption = 'manufacturing.bom_consumption';
    case ProductionCompletion = 'manufacturing.production_completion';
    case Scrap = 'manufacturing.scrap';
    case Rework = 'manufacturing.rework';

    // ── Orders ──────────────────────────────────────────────────────────────────
    case OrderConfirmation = 'orders.order_confirmation';         // no GL before policy
    case OrderReservation = 'orders.reservation';                 // no GL
    case OrderCancellation = 'orders.cancellation';               // no GL by default

    // ── POS ─────────────────────────────────────────────────────────────────────
    case PosSale = 'pos.sale';
    case PosReturn = 'pos.return';
    case PosDiscount = 'pos.discount';
    case PosRefund = 'pos.refund';
    case PosCashDrawer = 'pos.cash_drawer';

    // ── Shipping ────────────────────────────────────────────────────────────────
    case ShipmentCost = 'shipping.shipment_cost';
    case DeliveryConfirmation = 'shipping.delivery_confirmation'; // no GL by default
    case DeliveryFailure = 'shipping.delivery_failure';
    case ReturnShipment = 'shipping.return_shipment';

    // ── CRM & Marketing ─────────────────────────────────────────────────────────
    case CouponRedemption = 'crm.coupon_redemption';
    case MarketingCredit = 'crm.marketing_credit';
    case LoyaltyEarn = 'crm.loyalty_earn';
    case LoyaltyRedeem = 'crm.loyalty_redeem';

    public function module(): string
    {
        return explode('.', $this->value)[0];
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    public static function tryFromValue(string $value): ?self
    {
        return self::tryFrom($value);
    }
}
