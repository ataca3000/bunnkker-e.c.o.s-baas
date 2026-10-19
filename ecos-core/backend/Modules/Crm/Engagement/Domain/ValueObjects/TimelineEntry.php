<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\ValueObjects;

use Illuminate\Support\Carbon;

/**
 * A single, source-agnostic entry on the customer timeline.
 *
 * Whether it originated in the CRM (a logged call) or was READ from another
 * system (a conversation, an order), it presents the same shape. The timeline is
 * the union of these entries, sorted by time — append-only, never rewritten.
 */
final class TimelineEntry
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public readonly string $source,       // crm | customer_engagement | commerce | ...
        public readonly string $type,         // call | email | conversation | order | note | task | ...
        public readonly string $title,
        public readonly Carbon $occurredAt,
        public readonly ?string $channel = null,
        public readonly ?string $direction = null,
        public readonly ?string $body = null,
        public readonly ?string $refType = null,
        public readonly ?string $refId = null,
        public readonly ?int $actorId = null,
        public readonly array $meta = [],
    ) {}

    public function isInteraction(): bool
    {
        return $this->type !== 'system';
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'source' => $this->source,
            'type' => $this->type,
            'title' => $this->title,
            'channel' => $this->channel,
            'direction' => $this->direction,
            'body' => $this->body,
            'occurred_at' => $this->occurredAt->toIso8601String(),
            'ref' => $this->refType !== null ? ['type' => $this->refType, 'id' => $this->refId] : null,
            'actor_id' => $this->actorId,
            'meta' => $this->meta,
        ];
    }
}
