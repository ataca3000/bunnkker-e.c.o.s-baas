<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Contracts;

use Modules\System\Engineering\Domain\Models\EngineeringPipeline;

/**
 * Abstraction for a pipeline notification destination.
 *
 * Implementations: Database (current), Slack, Email, WhatsApp.
 * Registered in ProviderRegistry; selected per-template or globally.
 */
interface NotificationChannelInterface
{
    public function name(): string;

    /** @param array<string, mixed> $payload  Event-specific data */
    public function send(EngineeringPipeline $pipeline, string $event, array $payload = []): void;
}
