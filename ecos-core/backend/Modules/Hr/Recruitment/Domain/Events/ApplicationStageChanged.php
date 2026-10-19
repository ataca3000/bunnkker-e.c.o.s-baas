<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Events;

use Illuminate\Support\Carbon;

/** A candidate moved through the pipeline — announced for anything that notifies. */
final class ApplicationStageChanged
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $applicationId,
        public readonly ?string $fromStage,
        public readonly string $toStage,
        public readonly string $action,
        public readonly Carbon $occurredAt,
    ) {}

    public function eventName(): string
    {
        return 'hr.recruitment.application_stage_changed';
    }

    public function eventId(): string
    {
        return 'hr.recruitment.stage:'.$this->applicationId.':'.$this->occurredAt->getTimestampMs();
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'application_id' => $this->applicationId,
            'from_stage' => $this->fromStage,
            'to_stage' => $this->toStage,
            'action' => $this->action,
            'occurred_at' => $this->occurredAt->toDateTimeString(),
        ];
    }
}
