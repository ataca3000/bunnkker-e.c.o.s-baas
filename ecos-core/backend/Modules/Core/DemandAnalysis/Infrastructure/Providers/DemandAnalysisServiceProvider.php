<?php

declare(strict_types=1);

namespace Modules\Core\DemandAnalysis\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\DemandAnalysis\Application\Services\DemandAnalysisService;

final class DemandAnalysisServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(DemandAnalysisService::class);
    }
}
