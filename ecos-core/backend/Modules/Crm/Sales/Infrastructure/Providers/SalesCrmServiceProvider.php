<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Sales\Domain\Services\LeadService;
use Modules\Crm\Sales\Domain\Services\OpportunityService;
use Modules\Crm\Sales\Domain\Services\PipelineService;
use Modules\Crm\Sales\Domain\Services\QuoteService;
use Modules\Crm\Sales\Domain\Services\SalesActivityService;

/**
 * CRM Sales & Loyalty — EPIC C4 (Sales).
 *
 * ┌─ CRM OWNS THE SALES RELATIONSHIP ───────────────────────────────────────┐
 * │ Leads, opportunities, the pipeline, quotes and sales activities. Converting │
 * │ a lead bridges to the Customer Foundation (C1). Commerce owns the ORDER and │
 * │ Finance the PAYMENT — both referenced by opaque id only.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class SalesCrmServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PipelineService::class);
        $this->app->singleton(OpportunityService::class);
        $this->app->singleton(LeadService::class);
        $this->app->singleton(QuoteService::class);
        $this->app->singleton(SalesActivityService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
