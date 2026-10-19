<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Enums;

/**
 * A CRM actionable: a plain task, a follow-up, an appointment or a meeting. All
 * share a due date and a lifecycle; appointments and meetings also carry a
 * scheduled time and place.
 */
enum TaskType: string
{
    case Task = 'task';
    case FollowUp = 'follow_up';
    case Appointment = 'appointment';
    case Meeting = 'meeting';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }
}
