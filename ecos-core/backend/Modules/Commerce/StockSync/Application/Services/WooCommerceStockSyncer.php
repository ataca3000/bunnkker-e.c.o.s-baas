<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Application\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

final class WooCommerceStockSyncer
{
    public function updateStock(
        string $storeUrl,
        string $consumerKey,
        string $consumerSecret,
        string $externalProductId,
        float $stockQuantity,
    ): bool {
        try {
            $response = Http::withBasicAuth($consumerKey, $consumerSecret)
                ->timeout(15)
                ->put(
                    rtrim($storeUrl, '/').'/wp-json/wc/v3/products/'.$externalProductId,
                    [
                        'stock_quantity' => $stockQuantity,
                        'manage_stock' => true,
                    ],
                );

            return $response->successful();
        } catch (Throwable) {
            return false;
        }
    }
}
