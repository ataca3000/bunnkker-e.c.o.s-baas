<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Common\Snapshots\Application\Builders\BusinessContextSnapshotBuilder;
use Modules\Common\Snapshots\Application\Builders\FinancialSnapshotBuilder;
use Modules\Common\Snapshots\Application\Services\SnapshotManager;
use Modules\Common\Snapshots\Application\Validators\SnapshotValidator;
use Modules\Common\Snapshots\Domain\Engine\IntegrityEngine;
use Modules\Common\Snapshots\Domain\Timeline\SnapshotTimelineBuilder;

class SnapshotServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(IntegrityEngine::class, fn () => new IntegrityEngine);

        $this->app->singleton(SnapshotValidator::class, fn () => new SnapshotValidator);

        $this->app->singleton(
            BusinessContextSnapshotBuilder::class,
            fn () => new BusinessContextSnapshotBuilder,
        );

        $this->app->singleton(
            FinancialSnapshotBuilder::class,
            fn (/** @var \Illuminate\Contracts\Foundation\Application $app */ $app) => new FinancialSnapshotBuilder(
                $app->make(IntegrityEngine::class),
            ),
        );

        $this->app->singleton(
            SnapshotTimelineBuilder::class,
            fn () => new SnapshotTimelineBuilder,
        );

        $this->app->singleton(
            SnapshotManager::class,
            fn (/** @var \Illuminate\Contracts\Foundation\Application $app */ $app) => new SnapshotManager(
                $app->make(SnapshotValidator::class),
                $app->make(BusinessContextSnapshotBuilder::class),
                $app->make(FinancialSnapshotBuilder::class),
                $app->make(SnapshotTimelineBuilder::class),
            ),
        );
    }
}
