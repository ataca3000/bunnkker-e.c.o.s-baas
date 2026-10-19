<?php

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\RepairAnalysis;
use Modules\System\Engineering\Domain\Models\RepairPrompt;
use Modules\System\Engineering\Domain\Models\RepairSession;

class RepairPromptBuilder
{
    public function build(RepairSession $session, RepairAnalysis $analysis): RepairPrompt
    {
        RepairPrompt::where('session_id', $session->id)->update(['is_active' => false]);

        $version     = RepairPrompt::where('session_id', $session->id)->count() + 1;
        $promptType  = $version > 1 ? 'retry' : 'initial';

        $systemContext       = $this->buildSystemContext($session, $analysis);
        $repairInstructions  = $this->buildRepairInstructions($session, $analysis);
        $constraints         = $this->buildConstraints($session);
        $successCriteria     = $this->buildSuccessCriteria($analysis);
        $contextFiles        = $this->buildContextFiles($session, $analysis);
        $tokenEstimate       = $this->estimateTokens($systemContext, $repairInstructions);

        return RepairPrompt::create([
            'session_id'          => $session->id,
            'prompt_version'      => $version,
            'prompt_type'         => $promptType,
            'system_context'      => $systemContext,
            'repair_instructions' => $repairInstructions,
            'constraints'         => $constraints,
            'success_criteria'    => $successCriteria,
            'context_files'       => $contextFiles,
            'token_estimate'      => $tokenEstimate,
            'is_active'           => true,
            'created_at'          => now(),
        ]);
    }

    private function buildSystemContext(RepairSession $session, RepairAnalysis $analysis): string
    {
        $failureTypeLabel   = $this->resolveLabel($analysis->failure_type);
        $repairApproachLabel = $this->resolveLabel($analysis->repair_approach);
        $confidencePct      = number_format((float) $analysis->confidence_score * 100, 1);

        return sprintf(
            'You are operating within the ECOS ERP system, a Domain-Driven Design application built with Laravel (backend) and React (frontend). '
            . 'This system follows strict DDD layering with bounded contexts organized as Laravel modules. '
            . 'The current repair session targets a failure of type "%s". '
            . 'Root cause analysis has identified: %s. '
            . 'Confidence in this analysis is %s%%. '
            . 'The recommended repair approach is: %s.',
            $failureTypeLabel,
            $analysis->root_cause,
            $confidencePct,
            $repairApproachLabel
        );
    }

    private function buildRepairInstructions(RepairSession $session, RepairAnalysis $analysis): string
    {
        $failureTypeLabel    = $this->resolveLabel($analysis->failure_type);
        $repairApproachLabel = $this->resolveLabel($analysis->repair_approach);

        $lines   = [];
        $lines[] = '## Repair Task';
        $lines[] = '';
        $lines[] = 'Failure: ' . $session->failure_summary;
        $lines[] = 'Type: ' . $failureTypeLabel;
        $lines[] = 'Root Cause: ' . $analysis->root_cause;

        $affectedComponents = $analysis->affected_components ?? [];
        if (!empty($affectedComponents)) {
            $lines[] = '';
            $lines[] = '### Affected Components';
            foreach ($affectedComponents as $component) {
                $lines[] = '- ' . $component;
            }
        }

        $context = $session->context ?? [];

        if (!empty($context['error_message'])) {
            $lines[] = '';
            $lines[] = '### Error Message';
            $lines[] = '```';
            $lines[] = $context['error_message'];
            $lines[] = '```';
        }

        if (!empty($context['stack_trace'])) {
            $lines[] = '';
            $lines[] = '### Stack Trace';
            $lines[] = '```';
            $lines[] = $context['stack_trace'];
            $lines[] = '```';
        }

        $lines[] = '';
        $lines[] = '## Required Action';
        $lines[] = '';
        $lines[] = 'Apply the following repair approach: ' . $repairApproachLabel . '.';

        $retryCount = $session->retry_count ?? 0;
        if ($retryCount > 0) {
            $lines[] = '';
            $lines[] = 'Note: This is retry attempt ' . $retryCount
                . ' for this repair session. Previous attempts were unsuccessful;'
                . ' please ensure a different resolution strategy is applied.';
        }

        return implode("\n", $lines);
    }

    private function buildConstraints(RepairSession $session): array
    {
        return [
            'Limit changes strictly to the scope of the identified failure; do not refactor unrelated code.',
            'Preserve all existing API contracts and public method signatures unless the failure explicitly requires their modification.',
            'Do not introduce new package dependencies or composer/npm packages.',
            'Do not bypass authentication, authorization, or security checks under any circumstances.',
            'Ensure all existing tests continue to pass; add new tests where the repair introduces new behavior.',
            'Respect DDD layer boundaries (Domain, Application, Infrastructure, Presentation) and module isolation; all database migrations must include idempotency guards (Schema::hasTable / Schema::hasColumn).',
        ];
    }

    private function buildSuccessCriteria(RepairAnalysis $analysis): array
    {
        $repairApproach = $this->resolveValue($analysis->repair_approach);

        $criteria = [
            'All existing automated tests pass without modification to test assertions.',
            'The failure described in the repair session no longer reproduces in the target environment.',
            'No new linting, static analysis, or type errors are introduced.',
        ];

        switch ($repairApproach) {
            case 'direct_fix':
                $criteria[] = 'The specific error identified in the root cause analysis is fully resolved with no recurrence.';
                break;
            case 'refactor':
                $criteria[] = 'The affected code exhibits a cleaner DDD structure with responsibilities correctly assigned to the appropriate layers.';
                break;
            case 'documentation_only':
                $criteria[] = 'All documentation is complete, accurate, and consistent with the project documentation standards.';
                break;
            case 'configuration_change':
                $criteria[] = 'No hardcoded environment values are present; all configuration is resolved through the appropriate config or environment resolution mechanism.';
                break;
        }

        return $criteria;
    }

    private function buildContextFiles(RepairSession $session, RepairAnalysis $analysis): array
    {
        $affectedComponents = $analysis->affected_components ?? [];
        $tracked            = ['.php', '.ts', '.tsx'];
        $contextFiles       = [];

        foreach ($affectedComponents as $component) {
            foreach ($tracked as $ext) {
                if (str_contains((string) $component, $ext)) {
                    $contextFiles[] = [
                        'path'      => $component,
                        'relevance' => 'directly_affected',
                    ];
                    break;
                }
            }
        }

        return $contextFiles;
    }

    private function estimateTokens(string $systemContext, string $instructions): int
    {
        return (int) ceil((strlen($systemContext) + strlen($instructions)) / 4) + 500;
    }

    private function resolveLabel(mixed $value): string
    {
        if (is_object($value) && method_exists($value, 'label')) {
            return $value->label();
        }

        if ($value instanceof \BackedEnum) {
            return $value->value;
        }

        return (string) $value;
    }

    private function resolveValue(mixed $value): string
    {
        if ($value instanceof \BackedEnum) {
            return $value->value;
        }

        if (is_object($value) && property_exists($value, 'value')) {
            return (string) $value->value;
        }

        return (string) $value;
    }
}
