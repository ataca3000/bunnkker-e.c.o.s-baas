<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Infrastructure\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;
use Modules\Organization\BusinessAccounts\Infrastructure\Repositories\EloquentBusinessAccountRepository;
use Modules\Organization\BusinessAccounts\Presentation\Http\Policies\BusinessAccountPolicy;

final class BusinessAccountServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BusinessAccountRepositoryInterface::class, EloquentBusinessAccountRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(BusinessAccount::class, BusinessAccountPolicy::class);
    }
}
