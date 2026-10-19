<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Infrastructure\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;
use Modules\Organization\Teams\Domain\Models\Team;
use Modules\Organization\Teams\Infrastructure\Repositories\EloquentTeamRepository;
use Modules\Organization\Teams\Presentation\Http\Policies\TeamPolicy;

final class TeamServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(TeamRepositoryInterface::class, EloquentTeamRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(Team::class, TeamPolicy::class);
    }
}
