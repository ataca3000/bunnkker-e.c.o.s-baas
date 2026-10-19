<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Services\RecipeResolver;
use Modules\Manufacturing\BillsOfMaterials\Infrastructure\Repositories\EloquentBomRepository;
use Modules\Manufacturing\BillsOfMaterials\Infrastructure\Repositories\EloquentRecipeRepository;

final class BomServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BomRepositoryInterface::class, EloquentBomRepository::class);
        $this->app->bind(RecipeRepositoryInterface::class, EloquentRecipeRepository::class);
        $this->app->bind(RecipeResolverInterface::class, RecipeResolver::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
