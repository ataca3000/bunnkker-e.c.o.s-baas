<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\DecisionKernel\Domain\Services\DecisionKernel;
use Modules\Manufacturing\DecisionKernel\Domain\Services\RuleEvaluationPipeline;

/**
 * Registers the Decision Kernel as a singleton.
 *
 * The kernel is stateless — singleton is safe and avoids repeated
 * construction of the pipeline on every resolution.
 *
 * No RuleProviderInterface binding is registered here: callers supply
 * their own provider at evaluation time, keeping the kernel context-agnostic.
 */
final class DecisionKernelServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RuleEvaluationPipeline::class);
        $this->app->singleton(DecisionKernel::class);
    }
}
