<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Modules\System\Engineering\Domain\Enums\RiskLevel;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseRisk;

final class ReleaseRiskService
{
    public function analyze(EngineeringRelease $release): array
    {
        EngineeringReleaseRisk::where('release_id', $release->id)->delete();
        $risks = [];

        if ($release->is_breaking_change) {
            $risks[] = $this->createRisk($release, 'compatibility', 'Breaking Change Detected', 'This release contains breaking changes that may affect downstream consumers.', 'high', 'high', 75, 'Document all breaking changes. Notify affected teams. Coordinate rollout schedule.');
        }
        if ($release->task_count > 10) {
            $risks[] = $this->createRisk($release, 'scope', 'Large Release Scope', 'Releases with more than 10 tasks have higher risk of regressions.', 'medium', 'medium', 50, 'Consider splitting into smaller releases. Increase test coverage.');
        }
        $circDeps = $release->dependencies()->where('is_circular', true)->count();
        if ($circDeps > 0) {
            $risks[] = $this->createRisk($release, 'dependency', 'Circular Dependencies', "{$circDeps} circular dependencies detected.", 'high', 'high', 75, 'Resolve circular dependencies before proceeding.');
        }
        $unresolved = $release->dependencies()->where('status', 'unresolved')->where('is_blocking', true)->count();
        if ($unresolved > 0) {
            $risks[] = $this->createRisk($release, 'dependency', 'Unresolved Dependencies', "{$unresolved} blocking dependencies unresolved.", 'high', 'medium', 60, 'Resolve all blocking dependencies.');
        }
        if (!$release->scheduled_at) {
            $risks[] = $this->createRisk($release, 'planning', 'No Release Schedule', 'Release has no scheduled deployment time.', 'low', 'low', 15, 'Set a target release date.');
        }

        $overallRisk = $this->computeOverallRisk($risks);
        $release->update(['risk_level' => $overallRisk->value]);

        return ['risks' => $risks, 'risk_level' => $overallRisk->value, 'risk_count' => count($risks)];
    }

    public function acceptRisk(EngineeringReleaseRisk $risk, string $acceptedBy): void
    {
        $risk->update(['is_accepted' => true, 'accepted_by' => $acceptedBy, 'accepted_at' => now()]);
    }

    private function createRisk(EngineeringRelease $release, string $category, string $title, string $description, string $severity, string $likelihood, int $score, string $mitigation): EngineeringReleaseRisk
    {
        return EngineeringReleaseRisk::create([
            'company_id'       => $release->company_id,
            'release_id'       => $release->id,
            'risk_category'    => $category,
            'risk_title'       => $title,
            'risk_description' => $description,
            'severity'         => $severity,
            'likelihood'       => $likelihood,
            'risk_score'       => $score,
            'mitigation_plan'  => $mitigation,
        ]);
    }

    private function computeOverallRisk(array $risks): RiskLevel
    {
        if (empty($risks)) { return RiskLevel::Minimal; }
        $severities = array_column(array_map(fn($r) => ['s' => $r->severity->value], $risks), 's');
        if (in_array('critical', $severities)) { return RiskLevel::Critical; }
        if (in_array('high', $severities)) { return RiskLevel::High; }
        if (in_array('medium', $severities)) { return RiskLevel::Medium; }
        if (in_array('low', $severities)) { return RiskLevel::Low; }
        return RiskLevel::Minimal;
    }
}
