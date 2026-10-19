<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\PipelineStage;
use Modules\System\Engineering\Domain\ValueObjects\RetryPolicy;

/**
 * Produces RetryPolicy instances per pipeline stage.
 *
 * Priority: template stage config > hardcoded stage defaults.
 * The template engine passes per-stage overrides when creating pipelines from templates.
 */
final class RetryPolicyFactory
{
    /**
     * Build a RetryPolicy for a stage.
     * If $templateStageConfig contains a 'retry_policy' key it takes precedence.
     *
     * @param array<string, mixed> $templateStageConfig
     */
    public function make(PipelineStage $stage, array $templateStageConfig = []): RetryPolicy
    {
        if (! empty($templateStageConfig['retry_policy'])) {
            return RetryPolicy::fromArray((array) $templateStageConfig['retry_policy']);
        }

        // Fallback: hardcoded stage defaults (matches ENG-006 behaviour)
        return match ($stage) {
            PipelineStage::Build         => RetryPolicy::fromArray(['max_retries' => 2, 'backoff_strategy' => RetryPolicy::BACKOFF_LINEAR,      'retry_delay_seconds' => 10, 'timeout_seconds' => 300]),
            PipelineStage::Tests         => RetryPolicy::fromArray(['max_retries' => 1, 'backoff_strategy' => RetryPolicy::BACKOFF_FIXED,       'retry_delay_seconds' => 5,  'timeout_seconds' => 300]),
            PipelineStage::GitHubActions => RetryPolicy::fromArray(['max_retries' => 3, 'backoff_strategy' => RetryPolicy::BACKOFF_FIXED,       'retry_delay_seconds' => 30, 'timeout_seconds' => 600]),
            PipelineStage::HealthCheck   => RetryPolicy::fromArray(['max_retries' => 3, 'backoff_strategy' => RetryPolicy::BACKOFF_LINEAR,      'retry_delay_seconds' => 5,  'timeout_seconds' => 30]),
            PipelineStage::Commit        => RetryPolicy::noRetry(60),
            PipelineStage::Push          => RetryPolicy::noRetry(120),
            default                      => RetryPolicy::noRetry(120),
        };
    }
}
