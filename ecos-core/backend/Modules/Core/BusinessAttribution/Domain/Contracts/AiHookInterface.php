<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

use Modules\Core\BusinessAttribution\Domain\ValueObjects\CauseEffectChain;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayResult;

/**
 * Extension point: AI-powered root-cause analysis and insight generation.
 * Future AI engines implement this; BAE calls them with structured data.
 */
interface AiHookInterface
{
    /**
     * Analyse the cause→effect traversal chain and return a structured diagnosis.
     * Expected keys: root_cause, contributing_factors, recommendation, confidence.
     */
    public function analyzeRootCause(CauseEffectChain $chain): array;

    /**
     * Generate human-readable insights from a replay result.
     * Expected keys: summary, anomalies, patterns, next_actions.
     */
    public function generateInsights(ReplayResult $result): array;
}
