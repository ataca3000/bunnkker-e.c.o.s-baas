<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Engagement\Domain\Enums\ActivityDirection;
use Modules\Crm\Engagement\Domain\Enums\ActivityType;
use Modules\Crm\Engagement\Domain\Models\CustomerActivity;

/**
 * Logs CRM-owned interactions — the append-only writer of the activity log.
 *
 * Every call, email, WhatsApp/Messenger activity, note or meeting an agent
 * records becomes one immutable row. It never writes any other system's data.
 */
final class ActivityService
{
    /**
     * @param  array<string, mixed>  $data  subject, body, direction, channel, outcome, occurred_at, metadata, actor_id, related_type, related_id
     */
    public function log(string $companyId, string $customerId, ActivityType $type, array $data = []): CustomerActivity
    {
        $direction = isset($data['direction'])
            ? ActivityDirection::from((string) $data['direction'])
            : ($type === ActivityType::System ? ActivityDirection::Internal : ActivityDirection::Outbound);

        return CustomerActivity::create([
            'company_id' => $companyId,
            'customer_id' => $customerId,
            'activity_type' => $type->value,
            'direction' => $direction->value,
            'channel' => $data['channel'] ?? $type->defaultChannel(),
            'subject' => $data['subject'] ?? null,
            'body' => $data['body'] ?? null,
            'outcome' => $data['outcome'] ?? null,
            'occurred_at' => isset($data['occurred_at']) ? Carbon::parse($data['occurred_at']) : Carbon::now(),
            'related_type' => $data['related_type'] ?? null,
            'related_id' => $data['related_id'] ?? null,
            'metadata' => $data['metadata'] ?? null,
            'actor_id' => $data['actor_id'] ?? null,
        ]);
    }

    /** A system activity — the append-only record of a lifecycle event (task created/completed). */
    public function system(string $companyId, string $customerId, string $subject, ?string $relatedType = null, ?string $relatedId = null, ?int $actorId = null): CustomerActivity
    {
        return $this->log($companyId, $customerId, ActivityType::System, [
            'subject' => $subject,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
            'actor_id' => $actorId,
        ]);
    }
}
