<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Carbon;
use Modules\System\Engineering\Domain\Enums\RepairFailureType;
use Modules\System\Engineering\Domain\Models\RepairAnalysis;
use Modules\System\Engineering\Domain\Models\RepairSession;

class FailureAnalysisEngine
{
    public function __construct(
        private readonly RootCauseClassifier $classifier,
    ) {}

    public function analyze(RepairSession $session): RepairAnalysis
    {
        $context     = $session->failure_context ?? [];
        $failureType = $session->failure_type;   // RepairFailureType enum

        $rootCause  = $this->classifier->classify($failureType->value, $context);
        $approach   = $failureType->defaultApproach();
        $components = $this->classifyAffectedComponents($context);
        $evidence   = $this->extractEvidence($context);
        $confidence = $this->calculateConfidence($evidence, $context);
        $effort     = $this->estimateEffort($approach->value);

        return RepairAnalysis::create([
            'repair_session_id'       => $session->id,
            'failure_type'            => $failureType->value,
            'root_cause'              => $rootCause,
            'root_cause_description'  => $this->describeRootCause($failureType->value, $rootCause, $context),
            'recommended_approach'    => $approach->value,
            'affected_components'     => $components,
            'evidence'                => $evidence,
            'confidence_score'        => $confidence,
            'estimated_effort'        => $effort,
            'created_at'              => Carbon::now(),
        ]);
    }

    public function describeRootCause(string $failureType, string $rootCause, array $context): string
    {
        return $this->classifier->describeRootCause($failureType, $rootCause, $context);
    }

    private function classifyAffectedComponents(array $context): array
    {
        $components = [];

        if (!empty($context['file'])) {
            $components[] = $context['file'];
        }

        if (!empty($context['files']) && is_array($context['files'])) {
            $components = array_merge($components, $context['files']);
        }

        if (!empty($context['class'])) {
            $components[] = $context['class'];
        }

        if (!empty($context['module'])) {
            $components[] = $context['module'];
        }

        return array_values(array_unique($components));
    }

    private function extractEvidence(array $context): array
    {
        $evidence = [];
        $keys     = ['error_message', 'stack_trace', 'log_output', 'test_output', 'validation_errors'];

        foreach ($keys as $key) {
            if (!empty($context[$key])) {
                $evidence[$key] = $context[$key];
            }
        }

        return $evidence;
    }

    private function calculateConfidence(array $evidence, array $context): float
    {
        $score = 50.0;

        if (isset($evidence['error_message'])) {
            $score += 15.0;
        }

        if (isset($evidence['stack_trace'])) {
            $score += 15.0;
        }

        if (!empty($context['file']) || !empty($context['files'])) {
            $score += 10.0;
        }

        if (isset($evidence['test_output'])) {
            $score += 5.0;
        }

        if (isset($evidence['validation_errors'])) {
            $score += 5.0;
        }

        return min(100.0, $score);
    }

    private function estimateEffort(string $approachValue): string
    {
        return match ($approachValue) {
            'direct_fix', 'documentation_only', 'configuration_change' => 'low',
            'refactor'             => 'medium',
            'architectural_change' => 'high',
            'multi_step'           => 'very_high',
            default                => 'medium',
        };
    }
}
