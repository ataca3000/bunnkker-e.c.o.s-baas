<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\ManufacturingPolicy\Domain\Services\ManufacturingPolicy;

final class ManufacturingPolicyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ManufacturingPolicy::class);
    }
}
