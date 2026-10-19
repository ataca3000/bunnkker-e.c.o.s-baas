<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class POSServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            base_path('config/pos.php'),
            'pos',
        );
    }

    public function boot(): void
    {
        // Sub-domain migrations are loaded by their own service providers.
        // This provider is the module anchor; individual sub-domain SPs are
        // registered directly in bootstrap/providers.php as each package lands.
    }
}
