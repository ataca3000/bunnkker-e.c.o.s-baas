<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\ClaudeBridge\Domain\Contracts\ArtifactRepositoryInterface;
use Modules\ClaudeBridge\Domain\Contracts\AuditLogRepositoryInterface;
use Modules\ClaudeBridge\Domain\Contracts\ExecutionRepositoryInterface;
use Modules\ClaudeBridge\Domain\Contracts\TaskRepositoryInterface;
use Modules\ClaudeBridge\Domain\Contracts\WorkerRepositoryInterface;
use Modules\ClaudeBridge\Infrastructure\Repositories\EloquentArtifactRepository;
use Modules\ClaudeBridge\Infrastructure\Repositories\EloquentAuditLogRepository;
use Modules\ClaudeBridge\Infrastructure\Repositories\EloquentExecutionRepository;
use Modules\ClaudeBridge\Infrastructure\Repositories\EloquentTaskRepository;
use Modules\ClaudeBridge\Infrastructure\Repositories\EloquentWorkerRepository;

final class ClaudeBridgeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(TaskRepositoryInterface::class, EloquentTaskRepository::class);
        $this->app->bind(WorkerRepositoryInterface::class, EloquentWorkerRepository::class);
        $this->app->bind(ExecutionRepositoryInterface::class, EloquentExecutionRepository::class);
        $this->app->bind(ArtifactRepositoryInterface::class, EloquentArtifactRepository::class);
        $this->app->bind(AuditLogRepositoryInterface::class, EloquentAuditLogRepository::class);

        $this->mergeConfigFrom(__DIR__.'/../../config/claude-bridge.php', 'claude-bridge');
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
