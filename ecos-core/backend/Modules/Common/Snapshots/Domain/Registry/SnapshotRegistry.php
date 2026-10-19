<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Registry;

/**
 * Registry of every aggregate type that supports the Enterprise Snapshot Platform.
 * Provides discoverability without coupling the platform to implementation details.
 */
final class SnapshotRegistry
{
    /** @var array<string, array{description: string, module: string}> */
    private static array $types = [
        'order' => ['description' => 'Commerce Order',          'module' => 'Commerce\Orders'],
        'pos_sale' => ['description' => 'POS Sale',                'module' => 'POS\Sale'],
        'invoice' => ['description' => 'Customer Invoice',        'module' => 'Commerce\Invoices'],
        'purchase_order' => ['description' => 'Procurement Purchase Order', 'module' => 'Purchasing\PurchaseOrders'],
        'goods_receipt' => ['description' => 'Inventory Goods Receipt', 'module' => 'Purchasing\GoodsReceipts'],
        'supplier_invoice' => ['description' => 'Supplier Invoice',        'module' => 'Purchasing\SupplierInvoices'],
        'manufacturing_order' => ['description' => 'Manufacturing Order',    'module' => 'Manufacturing'],
        'supplier_return' => ['description' => 'Supplier Return',         'module' => 'Purchasing\SupplierReturns'],
    ];

    /** Register a new aggregate type. Call from consuming module service providers. */
    public static function register(string $type, string $description, string $module): void
    {
        self::$types[$type] = compact('description', 'module');
    }

    /** @return array<string, array{description: string, module: string}> */
    public static function all(): array
    {
        return self::$types;
    }

    public static function isSupported(string $type): bool
    {
        return array_key_exists($type, self::$types);
    }

    public static function describe(string $type): ?string
    {
        return self::$types[$type]['description'] ?? null;
    }
}
