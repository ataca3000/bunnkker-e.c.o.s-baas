<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Customers\Domain\Services\Customer360Service;
use Modules\Crm\Customers\Domain\Services\CustomerMergeService;
use Modules\Crm\Customers\Domain\Services\CustomerSearchService;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Customers\Domain\Services\DuplicateDetectionService;

/**
 * CRM Customer Foundation — EPIC C1.
 *
 * ┌─ THE SINGLE SOURCE OF TRUTH FOR CUSTOMER IDENTITY ──────────────────────┐
 * │ Enriches the existing `customers` master with the CRM foundation —         │
 * │ individuals & businesses, multiple contacts, tags, notes, documents,       │
 * │ preferences, groups, duplicate detection and merge — additively, on one    │
 * │ table. Commerce, Finance, Logistics and Marketing REFERENCE this identity; │
 * │ they never duplicate it.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CustomerFoundationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CustomerService::class);
        $this->app->singleton(Customer360Service::class);
        $this->app->singleton(CustomerSearchService::class);
        $this->app->singleton(DuplicateDetectionService::class);
        $this->app->singleton(CustomerMergeService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
