<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Admin\Configuration\Domain\Events\BrandPolicyUpdated;
use Modules\Organization\Brands\Application\Listeners\BrandPolicyUpdatedListener;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Brands\Infrastructure\Repositories\EloquentBrandRepository;
use Modules\Organization\Brands\Presentation\Http\Policies\BrandPolicy;

final class BrandServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BrandRepositoryInterface::class, EloquentBrandRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(Brand::class, BrandPolicy::class);

        // Sync minimum_margin_pct from Config OS to brands.default_target_margin (projection)
        Event::listen(BrandPolicyUpdated::class, BrandPolicyUpdatedListener::class);
    }
}
