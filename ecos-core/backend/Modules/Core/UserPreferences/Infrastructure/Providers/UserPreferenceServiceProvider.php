<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\UserPreferences\Domain\Contracts\UserPreferenceRepositoryInterface;
use Modules\Core\UserPreferences\Infrastructure\Repositories\EloquentUserPreferenceRepository;

/**
 * Service provider for the Core / UserPreferences module.
 *
 * Registered in bootstrap/providers.php.
 */
final class UserPreferenceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            UserPreferenceRepositoryInterface::class,
            EloquentUserPreferenceRepository::class,
        );
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
