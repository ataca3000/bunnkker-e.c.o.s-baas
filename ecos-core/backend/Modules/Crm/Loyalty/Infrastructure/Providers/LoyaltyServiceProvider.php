<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Loyalty\Domain\Services\LoyaltyProgramService;
use Modules\Crm\Loyalty\Domain\Services\PointsService;
use Modules\Crm\Loyalty\Domain\Services\RewardService;
use Modules\Crm\Loyalty\Domain\Services\WalletService;

/**
 * CRM Sales & Loyalty — EPIC C4 (Loyalty).
 *
 * ┌─ POINTS AS AN APPEND-ONLY LEDGER · WALLET DERIVED ──────────────────────┐
 * │ Programs, membership tiers, an append-only points ledger, rewards and the  │
 * │ wallet (a derived balance). Points earned from an order or a promotion      │
 * │ reference the source by opaque id — Commerce owns the order, Finance the    │
 * │ payment, Marketing the promotion.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LoyaltyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PointsService::class);
        $this->app->singleton(LoyaltyProgramService::class);
        $this->app->singleton(WalletService::class);
        $this->app->singleton(RewardService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
