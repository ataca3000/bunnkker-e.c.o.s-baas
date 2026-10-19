<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use InvalidArgumentException;
use Modules\Core\BusinessAttribution\Application\Services\EventReplayService;

/**
 * Replay business events for AI, debugging, analytics, and auditing.
 */
final class ReplayEventsAction
{
    public function __construct(
        private readonly EventReplayService $replayService,
    ) {}

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(string $replayType, array $params): array
    {
        return match ($replayType) {
            'entity' => $this->replayService->replayForEntity($params['entity_type'], $params['entity_id']),
            'dna' => $this->replayService->replayForDna($params['dna_id']),
            'correlation' => $this->replayService->replayForCorrelation($params['correlation_id']),
            'campaign' => $this->replayService->replayCampaignJourney($params['campaign_id']),
            default => throw new InvalidArgumentException("Unknown replay type: {$replayType}"),
        };
    }
}
