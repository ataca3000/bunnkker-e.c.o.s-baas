<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Enums;

/**
 * The kind of engagement activity logged in the CRM. These are the interactions
 * the CRM OWNS — an agent logging a call, an email, a meeting held, a note.
 * Interactions that live in other systems (conversations, orders) are read into
 * the timeline from those systems, never re-typed here.
 */
enum ActivityType: string
{
    case Call = 'call';
    case Email = 'email';
    case Whatsapp = 'whatsapp';
    case Messenger = 'messenger';
    case Sms = 'sms';
    case Note = 'note';
    case Meeting = 'meeting';
    case Visit = 'visit';
    case System = 'system';

    /** The default medium for this activity, when the caller does not set one. */
    public function defaultChannel(): string
    {
        return match ($this) {
            self::Call => 'phone',
            self::Email => 'email',
            self::Whatsapp => 'whatsapp',
            self::Messenger => 'messenger',
            self::Sms => 'sms',
            self::Meeting, self::Visit => 'in_person',
            default => 'system',
        };
    }

    public function isInteraction(): bool
    {
        return $this !== self::System;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
