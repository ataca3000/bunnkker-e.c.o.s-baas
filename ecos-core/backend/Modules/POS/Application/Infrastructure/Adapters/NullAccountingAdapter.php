<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Adapters;

use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Contracts\AccountingPortInterface;
use Modules\POS\Application\Events\SaleFinalized;

/**
 * Null adapter for AccountingPortInterface.
 *
 * Used until a dedicated Accounting module is implemented.
 * Logs the intent so every sale is observable in the audit log
 * even without a real accounting backend.
 *
 * When the Accounting module is ready:
 *   1. Create AccountingModuleAdapter implementing AccountingPortInterface.
 *   2. Swap the binding in EventServiceProvider::register().
 *   3. Delete this class.
 */
final class NullAccountingAdapter implements AccountingPortInterface
{
    public function recordSale(SaleFinalized $event): void
    {
        Log::channel('daily')->info('[POS][Accounting] Sale recorded — no accounting module installed', [
            'sale_id' => $event->saleId,
            'receipt_number' => $event->receiptNumber,
            'grand_total' => $event->grandTotal,
            'currency' => $event->currency,
            'company_id' => $event->companyId,
        ]);
    }
}
