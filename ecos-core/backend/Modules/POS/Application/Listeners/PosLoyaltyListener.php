<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Throwable;

/**
 * Subscriber 5 — Loyalty Points
 *
 * Awards loyalty points to the customer when a POS sale completes.
 *
 * Responsibilities:
 *   - Earn points based on sale total (logic in LoyaltyGatewayInterface).
 *   - Update membership level (handled inside gateway implementation).
 *   - Append loyalty history entry.
 *
 * Safe no-op when:
 *   - Loyalty is disabled via config ('pos.loyalty.enabled').
 *   - No customer is associated with the sale (anonymous / walk-in).
 *   - NullLoyaltyGateway is bound (Loyalty module not yet implemented).
 *
 * Idempotency:
 *   The `transactionRef` passed to earnPoints() is the sale UUID.
 *   Concrete gateway implementations must use this to deduplicate.
 *
 * Safety: NEVER throws — the sale is already committed and must not be affected.
 */
final class PosLoyaltyListener
{
    public function __construct(
        private readonly LoyaltyGatewayInterface $loyalty,
    ) {}

    public function handle(SaleFinalized $event): void
    {
        if (! (bool) config('pos.loyalty.enabled', false)) {
            return;
        }

        if (! $event->hasCustomer()) {
            return;
        }

        try {
            $saleTotal = Money::of($event->grandTotal, $event->currency);

            $pointsEarned = $this->loyalty->earnPoints(
                customerId: (string) $event->customerId,
                saleTotal: $saleTotal,
                transactionRef: $event->saleId,
            );

            Log::channel('daily')->info('[POS][Loyalty] Points earned', [
                'customer_id' => $event->customerId,
                'sale_id' => $event->saleId,
                'points_earned' => $pointsEarned,
                'sale_total' => $event->grandTotal,
            ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[POS][Loyalty] Failed to award loyalty points', [
                'customer_id' => $event->customerId,
                'sale_id' => $event->saleId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
