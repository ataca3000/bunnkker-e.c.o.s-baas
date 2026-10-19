<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;

/**
 * The configurable recruitment pipeline.
 *
 * ┌─ THE STAGES ARE DATA ───────────────────────────────────────────────────┐
 * │ Applied → Initial Review → Phone Interview → Interview → Final Interview   │
 * │ → Accepted/Rejected is the default that gets SEEDED, not a sequence the     │
 * │ code knows. A company can rename, reorder, add or remove stages, and the    │
 * │ engine keeps working because it navigates by `sequence` and reads meaning   │
 * │ from `type` rather than from a stage's name.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class RecruitmentPipelineService
{
    /** @return \Illuminate\Database\Eloquent\Collection<int, RecruitmentStage> */
    public function stages(string $companyId)
    {
        return RecruitmentStage::query()
            ->where('company_id', $companyId)
            ->active()
            ->get();
    }

    /** Where a brand new application lands. */
    public function initialStage(string $companyId): RecruitmentStage
    {
        $stage = RecruitmentStage::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderByDesc('is_initial')
            ->orderBy('sequence')
            ->first();

        if ($stage === null) {
            throw RecruitmentException::noPipelineConfigured();
        }

        return $stage;
    }

    /** The stage after this one, or null at the end of the pipeline. */
    public function nextStage(RecruitmentStage $stage): ?RecruitmentStage
    {
        return RecruitmentStage::query()
            ->where('company_id', $stage->company_id)
            ->where('is_active', true)
            ->where('sequence', '>', $stage->sequence)
            // A terminal stage is reached by a decision, never by advancing.
            ->where('is_terminal', false)
            ->orderBy('sequence')
            ->first();
    }

    public function create(string $companyId, array $data): RecruitmentStage
    {
        return RecruitmentStage::create([
            'company_id' => $companyId,
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'sequence' => (int) ($data['sequence'] ?? $this->nextSequence($companyId)),
            'type' => $data['type'] ?? 'screening',
            'is_initial' => $data['is_initial'] ?? false,
            'is_terminal' => $data['is_terminal'] ?? false,
            'is_active' => $data['is_active'] ?? true,
            'color' => $data['color'] ?? null,
        ]);
    }

    public function update(RecruitmentStage $stage, array $data): RecruitmentStage
    {
        $stage->update(array_intersect_key($data, array_flip([
            'code', 'name', 'description', 'sequence', 'type',
            'is_initial', 'is_terminal', 'is_active', 'color',
        ])));

        return $stage->refresh();
    }

    /** Guard: a stage handed in from a request must belong to this company. */
    public function assertBelongsTo(string $companyId, RecruitmentStage $stage): void
    {
        if ((string) $stage->company_id !== $companyId) {
            throw RecruitmentException::stageNotInPipeline();
        }
    }

    private function nextSequence(string $companyId): int
    {
        return (int) RecruitmentStage::query()->where('company_id', $companyId)->max('sequence') + 1;
    }
}
