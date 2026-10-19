<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;

/**
 * Single source of truth for WooCommerce → ECOS order status translation.
 *
 * Both WooCommerceOrderImporter and ProcessOrderWebhookJob must use this class.
 * No other code should define a WC status mapping table.
 */
final class WooCommerceOrderStatusTranslator
{
    /**
     * WooCommerce status → ECOS OrderStatus backing value.
     *
     * Right-hand values follow the V3 lifecycle established by
     * 2026_07_22_100000_simplify_order_lifecycle_v3.php:
     *   pending → new, processing → in_progress, completed → delivered.
     *
     * 'pending' and 'processing' were ECOS statuses before V3 and no longer
     * exist on the enum, so tryFrom() returned null for them and every imported
     * pending or processing WooCommerce order silently lost its status.
     */
    private const MAP = [
        'pending' => 'new',
        'on-hold' => 'awaiting_payment',
        'processing' => 'in_progress',
        'completed' => 'delivered',
        'cancelled' => 'cancelled',
        'refunded' => 'returned',
        'failed' => 'cancelled',
    ];

    /**
     * Translate a WooCommerce order status string to an ECOS OrderStatus enum.
     *
     * Returns null when the WC status has no meaningful ECOS equivalent
     * (e.g. 'trash', plugin-custom statuses).
     */
    public function translate(string $wcStatus): ?OrderStatus
    {
        $value = self::MAP[strtolower($wcStatus)] ?? null;

        return $value !== null ? OrderStatus::tryFrom($value) : null;
    }

    public function hasMapping(string $wcStatus): bool
    {
        return isset(self::MAP[strtolower($wcStatus)]);
    }
}
