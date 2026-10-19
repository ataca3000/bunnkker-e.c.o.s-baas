<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum CommunicationProvider: string
{
    case WhatsApp = 'whatsapp';
    case Messenger = 'messenger';
    case Instagram = 'instagram';
    case Email = 'email';
    case LiveChat = 'live_chat';
    case Telegram = 'telegram';
    case Sms = 'sms';

    public function label(): string
    {
        return match ($this) {
            self::WhatsApp => 'WhatsApp',
            self::Messenger => 'Facebook Messenger',
            self::Instagram => 'Instagram Direct',
            self::Email => 'Email',
            self::LiveChat => 'Live Chat',
            self::Telegram => 'Telegram',
            self::Sms => 'SMS',
        };
    }

    public function isActive(): bool
    {
        return in_array($this, [self::WhatsApp, self::Messenger, self::Instagram]);
    }
}
