<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Modules\Core\BusinessAttribution\Application\Services\BusinessDnaService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessJourneyService;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;
use Modules\Core\BusinessAttribution\Domain\Models\JourneyStep;

/**
 * Record a single journey stage transition for any business entity.
 * The calling module only needs to know: entity type + entity ID + stage.
 */
final class RecordJourneyStepAction
{
    public function __construct(
        private readonly BusinessDnaService $dnaService,
        private readonly BusinessJourneyService $journeyService,
    ) {}

    /**
     * @param  array<string, mixed>  $stepData  Optional: event_id, actor_id, actor_type, occurred_at, payload
     * @param  array<string, mixed>  $dnaDefaults  Optional defaults when DNA doesn't yet exist
     */
    public function execute(
        string $entityType,
        string $entityId,
        JourneyStage $stage,
        array $stepData = [],
        array $dnaDefaults = [],
    ): JourneyStep {
        // Auto-create DNA if missing
        $dna = $this->dnaService->getOrCreate($entityType, $entityId, $dnaDefaults);

        return $this->journeyService->recordStep($dna->id, $stage, $stepData);
    }
}
