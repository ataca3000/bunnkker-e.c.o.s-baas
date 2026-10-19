<?php

declare(strict_types=1);

namespace Modules\Commerce\Connectors\Application\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

final class WooCommerceConnector
{
    public function testConnection(string $storeUrl, string $consumerKey, string $consumerSecret): bool
    {
        try {
            $response = Http::withBasicAuth($consumerKey, $consumerSecret)
                ->timeout(10)
                ->get(rtrim($storeUrl, '/').'/wp-json/wc/v3/system_status');

            return $response->successful();
        } catch (Throwable) {
            return false;
        }
    }
}
