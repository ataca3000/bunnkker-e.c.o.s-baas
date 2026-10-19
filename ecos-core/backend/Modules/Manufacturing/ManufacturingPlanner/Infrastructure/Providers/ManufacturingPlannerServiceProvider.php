<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\ManufacturingPlanner\Domain\Services\ManufacturingPlanner;

final class ManufacturingPlannerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ManufacturingPlanner::class);
    }
}
