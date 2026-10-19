<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\ValidationReport;
use Modules\System\Engineering\Domain\Models\ValidationStep;

/**
 * Builds the persistent validation report for a patch validation run
 * (TASK-ENG-V2-002 Self-Healing Pipeline).
 *
 * Each validation gets exactly one full report: a structured summary
 * (for API/dashboard consumption) plus a human-readable markdown document.
 */
class ValidationReportService
{
    public function generate(PatchValidation $validation): ValidationReport
    {
        $validation->loadMissing('steps');

        /** @var Collection<int, ValidationStep> $steps */
        $steps = $validation->steps;

        $duration = ($validation->started_at !== null && $validation->completed_at !== null)
            ? $validation->started_at->diffInSeconds($validation->completed_at)
            : null;

        $summary = [
            'status'              => $validation->status?->value,
            'verdict'             => $validation->verdict?->value,
            'attempt_number'      => $validation->attempt_number,
            'total_steps'         => $validation->total_steps,
            'passed_steps'        => $validation->passed_steps,
            'failed_steps'        => $validation->failed_steps,
            'skipped_steps'       => $validation->skipped_steps,
            'is_blocking_failure' => $validation->is_blocking_failure,
            'duration'            => $duration,
            'validators'          => $steps->map(static fn (ValidationStep $step): array => [
                'validator'   => $step->validator?->value,
                'status'      => $step->status?->value,
                'is_blocking' => $step->is_blocking,
                'duration_ms' => $step->duration_ms,
                'exit_code'   => $step->exit_code,
            ])->values()->all(),
        ];

        $content = $this->buildMarkdown($validation, $steps);

        ValidationReport::where('validation_id', $validation->id)->delete();

        return ValidationReport::create([
            'validation_id' => $validation->id,
            'patch_id'      => $validation->patch_id,
            'company_id'    => $validation->company_id,
            'report_type'   => 'full',
            'summary'       => $summary,
            'content'       => $content,
            'generated_at'  => now(),
            'created_at'    => now(),
        ]);
    }

    /**
     * @param  Collection<int, ValidationStep>  $steps
     */
    private function buildMarkdown(PatchValidation $validation, Collection $steps): string
    {
        $lines = [];

        $lines[] = '# Patch Validation Report';
        $lines[] = '';
        $lines[] = '- **Validation ID:** '.$validation->id;
        $lines[] = '- **Patch ID:** '.$validation->patch_id;
        $lines[] = '- **Attempt:** '.$validation->attempt_number;
        $lines[] = '- **Status:** '.($validation->status?->value ?? 'unknown');
        $lines[] = '- **Verdict:** '.($validation->verdict?->value ?? 'pending');
        $lines[] = '- **Started At:** '.($validation->started_at?->toDateTimeString() ?? '-');
        $lines[] = '- **Completed At:** '.($validation->completed_at?->toDateTimeString() ?? '-');
        $lines[] = '';

        $lines[] = '## Step Results';
        $lines[] = '';
        $lines[] = '| Validator | Status | Blocking | Duration | Exit Code |';
        $lines[] = '|-----------|--------|----------|----------|-----------|';

        foreach ($steps as $step) {
            $lines[] = sprintf(
                '| %s | %s | %s | %s | %s |',
                $step->validator?->value ?? '-',
                $step->status?->value ?? '-',
                $step->is_blocking ? 'yes' : 'no',
                $step->duration_ms !== null ? $step->duration_ms.' ms' : '-',
                $step->exit_code ?? '-'
            );
        }

        $lines[] = '';

        $failedSteps = $steps->filter(
            static fn (ValidationStep $step): bool => (bool) $step->status?->isFailure()
        );

        $lines[] = '## Failures';
        $lines[] = '';

        if ($failedSteps->isEmpty()) {
            $lines[] = 'No failures recorded.';
            $lines[] = '';
        } else {
            foreach ($failedSteps as $step) {
                $output = $step->error_output ?: $step->output;

                $lines[] = '### '.($step->validator?->value ?? 'unknown');
                $lines[] = '';
                $lines[] = '```';
                $lines[] = $output !== null && $output !== ''
                    ? mb_substr($output, 0, 500)
                    : '(no output captured)';
                $lines[] = '```';
                $lines[] = '';
            }
        }

        $lines[] = '## Conclusion';
        $lines[] = '';

        if ($failedSteps->isEmpty()) {
            $lines[] = 'The patch was accepted: all applicable validators passed.';
        } else {
            $failingNames = $failedSteps
                ->map(static fn (ValidationStep $step): string => $step->validator?->value ?? 'unknown')
                ->unique()
                ->values()
                ->implode(', ');

            $lines[] = 'The patch was rejected due to failing validators: '.$failingNames.'.';
        }

        $lines[] = '';

        return implode("\n", $lines);
    }

    public function getForValidation(string $validationId, string $companyId): ?ValidationReport
    {
        return ValidationReport::where('validation_id', $validationId)
            ->where('company_id', $companyId)
            ->first();
    }

    public function listForPatch(string $patchId, string $companyId): Collection
    {
        return ValidationReport::where('patch_id', $patchId)
            ->where('company_id', $companyId)
            ->orderBy('generated_at', 'desc')
            ->get();
    }
}
