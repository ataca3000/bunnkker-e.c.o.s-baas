<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\GuardianReport;
use Modules\System\Engineering\Domain\Models\GuardianRun;

/**
 * Builds the persistent Guardian report for a completed run
 * (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 *
 * Each run gets exactly one report: a structured summary (for
 * API/dashboard consumption) plus a human-readable markdown document
 * with diagnostics, remediation guidance and next steps.
 */
class GuardianReportService
{
    public function __construct(
        private readonly GuardianDiagnosticsEngine $diagnostics,
    ) {}

    public function generate(GuardianRun $run): GuardianReport
    {
        $run->loadMissing('checks');

        $diag = $this->diagnostics->buildDiagnostics($run);

        $summary = [
            'status'              => $run->status?->value,
            'decision'            => $run->decision?->value,
            'trigger_source'      => $run->trigger_source,
            'branch'              => $run->branch,
            'commit_ref'          => $run->commit_ref,
            'total_checks'        => $run->total_checks,
            'failed_checks_count' => $run->failed_checks_count,
            'repair_session_id'   => $run->repair_session_id,
            'validation_id'       => $run->validation_id,
            'diagnostics'         => $diag,
        ];

        $content = $this->buildMarkdown($run, $diag);

        GuardianReport::where('run_id', $run->id)->delete();

        return GuardianReport::create([
            'run_id'       => $run->id,
            'company_id'   => $run->company_id,
            'summary'      => $summary,
            'content'      => $content,
            'generated_at' => now(),
            'created_at'   => now(),
        ]);
    }

    private function buildMarkdown(GuardianRun $run, array $diag): string
    {
        /** @var Collection<int, GuardianCheck> $checks */
        $checks = $run->checks;

        $lines = [];

        $lines[] = '# Engineering Guardian Report';
        $lines[] = '';
        $lines[] = '- **Run ID:** '.$run->id;
        $lines[] = '- **Trigger:** '.($run->trigger_source ?? '-');
        $lines[] = '- **Branch:** '.($run->branch ?? '-');
        $lines[] = '- **Commit:** '.($run->commit_ref ?? '-');
        $lines[] = '- **Status:** '.($run->status?->value ?? 'unknown');

        $decision = $run->decision?->value ?? 'pending';
        $lines[] = '- **Decision:** '.$decision.(
            $run->decision_reason !== null && $run->decision_reason !== ''
                ? ' ('.$run->decision_reason.')'
                : ''
        );
        $lines[] = '';

        $lines[] = '## Summary';
        $lines[] = '';
        $lines[] = (string) ($diag['headline'] ?? '');
        $lines[] = '';

        $lines[] = '## Checks';
        $lines[] = '';
        $lines[] = '| Check | Category | Status | Blocking |';
        $lines[] = '|-------|----------|--------|----------|';

        foreach ($checks as $check) {
            $lines[] = sprintf(
                '| %s | %s | %s | %s |',
                $check->check_name ?? '-',
                $check->category?->value ?? '-',
                $check->status?->value ?? '-',
                $check->is_blocking ? 'yes' : 'no'
            );
        }

        $lines[] = '';

        $lines[] = '## Failures';
        $lines[] = '';

        $failures = $diag['failures'] ?? [];

        if ($failures === []) {
            $lines[] = 'No failures recorded.';
            $lines[] = '';
        } else {
            foreach ($failures as $failure) {
                $lines[] = '### '.($failure['check_name'] ?? 'unknown');
                $lines[] = '';

                if (($failure['summary'] ?? '') !== '') {
                    $lines[] = $failure['summary'];
                    $lines[] = '';
                }

                $lines[] = '**Remediation:** '.($failure['remediation'] ?? '-');
                $lines[] = '';
            }
        }

        $lines[] = '## Repair';
        $lines[] = '';

        if ($run->repair_session_id !== null) {
            $lines[] = 'Repair session **'.$run->repair_session_id.'** was opened for this run. A structured repair prompt is available via the AI Repair Platform.';
        } else {
            $lines[] = 'No repair session opened.';
        }

        $lines[] = '';

        if ($run->validation_id !== null) {
            $lines[] = '## Validation';
            $lines[] = '';
            $lines[] = 'Patch validation **'.$run->validation_id.'** is linked to this run; see the validation report for step-level results.';
            $lines[] = '';
        }

        $lines[] = '## Next Steps';
        $lines[] = '';

        foreach (($diag['next_steps'] ?? []) as $index => $step) {
            $lines[] = ($index + 1).'. '.$step;
        }

        $lines[] = '';

        return implode("\n", $lines);
    }

    public function getForRun(string $runId, string $companyId): ?GuardianReport
    {
        return GuardianReport::where('run_id', $runId)
            ->where('company_id', $companyId)
            ->first();
    }
}
