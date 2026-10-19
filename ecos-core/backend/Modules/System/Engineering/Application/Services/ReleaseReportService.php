<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseReport;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

final class ReleaseReportService
{
    public function generateAll(EngineeringRelease $release): array
    {
        $reports = [];
        $reports[] = $this->generateExecutiveSummary($release);
        $reports[] = $this->generateEngineeringSummary($release);
        $reports[] = $this->generateChangelog($release);
        $reports[] = $this->generateRiskReport($release);
        $reports[] = $this->generateRollbackNotes($release);
        return $reports;
    }

    public function generateExecutiveSummary(EngineeringRelease $release): EngineeringReleaseReport
    {
        $tasks    = empty($release->task_ids) ? collect() : EngineeringTask::whereIn('id', $release->task_ids)->get();
        $score    = $release->readiness_score;
        $riskLvl  = $release->risk_level->value ?? 'unknown';
        $taskList = $tasks->map(fn($t) => "- [{$t->status->value}] {$t->title}")->join("\n");
        $content = <<<EOT
# Executive Summary: {$release->name}

**Version:** {$release->version}
**Status:** {$release->status->value}
**Readiness Score:** {$score}%
**Risk Level:** {$riskLvl}
**Breaking Changes:** {$this->bool($release->is_breaking_change)}
**Target Environment:** {$release->target_environment}
**Tasks Included:** {$release->task_count}

## Description
{$release->description}

## Included Tasks
{$taskList}

## Approval Status
Pending approvals to be collected once workflow is initiated.

## Notes
{$this->formatNotes($release, 'executive')}
EOT;
        return $this->upsertReport($release, 'executive_summary', 'Executive Summary', $content, ['task_count' => $release->task_count, 'readiness_score' => $score, 'risk_level' => $riskLvl]);
    }

    public function generateEngineeringSummary(EngineeringRelease $release): EngineeringReleaseReport
    {
        $validation = $release->validations()->get();
        $passed     = $validation->where('passed', true)->count();
        $failed     = $validation->where('passed', false)->count();
        $breakdown  = $release->readiness_breakdown ?? [];
        $rows       = collect($breakdown)->map(fn($v, $k) => "| " . ucfirst($k) . " | {$v}% |")->join("\n");
        $content = <<<EOT
# Engineering Summary: {$release->name}

## Readiness Breakdown
| Dimension | Score |
|-----------|-------|
{$rows}

## Validation Results
- Passed: {$passed}
- Failed: {$failed}

## Validation Detail
{$validation->map(fn($c) => ($c->passed ? '✅' : '❌') . " {$c->check_name}: {$c->message}")->join("\n")}

## Artifacts
{$release->artifacts()->count()} artifacts attached.

## Dependencies
- Total: {$release->dependencies()->count()}
- Resolved: {$release->dependencies()->where('status', 'resolved')->count()}
- Unresolved: {$release->dependencies()->where('status', 'unresolved')->count()}
EOT;
        return $this->upsertReport($release, 'engineering_summary', 'Engineering Summary', $content, ['passed' => $passed, 'failed' => $failed, 'breakdown' => $breakdown]);
    }

    public function generateChangelog(EngineeringRelease $release): EngineeringReleaseReport
    {
        $tasks = empty($release->task_ids) ? collect() : EngineeringTask::whereIn('id', $release->task_ids)->get();
        $lines = $tasks->map(function ($t) {
            $priority = $t->priority->value ?? 'normal';
            return "- **[{$priority}]** {$t->title}";
        })->join("\n");
        $breakingChanges = $release->is_breaking_change
            ? collect($release->breaking_changes ?? [])->join("\n")
            : 'None';
        $content = <<<EOT
# Release Notes: {$release->name} v{$release->version}

## What's Changed
{$lines}

## Breaking Changes
{$breakingChanges}

## Notes
{$this->formatNotes($release, 'release')}
EOT;
        return $this->upsertReport($release, 'release_notes', 'Release Notes / Changelog', $content, ['task_count' => $tasks->count()]);
    }

    public function generateRiskReport(EngineeringRelease $release): EngineeringReleaseReport
    {
        $risks = $release->risks()->orderBy('risk_score', 'desc')->get();
        $rows  = $risks->map(fn($r) => "| {$r->risk_title} | {$r->severity->value} | {$r->risk_score} | " . ($r->is_accepted ? 'Accepted' : 'Open') . " |")->join("\n");
        $content = <<<EOT
# Risk Report: {$release->name}

**Overall Risk Level:** {$release->risk_level->value}

## Risk Register
| Risk | Severity | Score | Status |
|------|----------|-------|--------|
{$rows}

## Mitigation Plans
{$risks->map(fn($r) => "### {$r->risk_title}\n{$r->mitigation_plan}")->join("\n\n")}
EOT;
        return $this->upsertReport($release, 'risk_report', 'Risk Report', $content, ['risk_count' => $risks->count(), 'risk_level' => $release->risk_level->value]);
    }

    public function generateRollbackNotes(EngineeringRelease $release): EngineeringReleaseReport
    {
        $tasks = empty($release->task_ids) ? collect() : EngineeringTask::whereIn('id', $release->task_ids)->get();
        $content = <<<EOT
# Rollback Notes: {$release->name}

## Rollback Steps
1. Stop current deployment pipeline
2. Restore previous release artifacts
3. Revert database migrations (see Database Rollback section)
4. Update configuration to previous version
5. Verify service health

## Affected Modules
{$tasks->pluck('title')->map(fn($t) => "- {$t}")->join("\n")}

## Database Rollback
Review migration files included in this release and execute rollback scripts in reverse order.

## Configuration Rollback
Restore configuration from the backup taken at release time.

## Verification
Run smoke tests against the rolled-back environment.
EOT;
        return $this->upsertReport($release, 'rollback_notes', 'Rollback Notes', $content, []);
    }

    private function upsertReport(EngineeringRelease $release, string $type, string $title, string $content, array $data): EngineeringReleaseReport
    {
        return EngineeringReleaseReport::updateOrCreate(
            ['release_id' => $release->id, 'report_type' => $type],
            ['company_id' => $release->company_id, 'title' => $title, 'content' => $content, 'structured_data' => $data, 'generated_at' => now(), 'is_final' => false, 'generated_by' => 'system']
        );
    }

    private function formatNotes(EngineeringRelease $release, string $section): string
    {
        return $release->notes()->where('section', $section)->get()->map(fn($n) => $n->content)->join("\n\n") ?: 'No notes.';
    }

    private function bool(bool $v): string { return $v ? 'Yes' : 'No'; }
}
