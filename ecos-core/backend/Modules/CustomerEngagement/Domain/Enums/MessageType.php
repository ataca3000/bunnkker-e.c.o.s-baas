<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum MessageType: string
{
    case Text = 'text';
    case Image = 'image';
    case Video = 'video';
    case Audio = 'audio';
    case Document = 'document';
    case Template = 'template';
    case Location = 'location';
    case Sticker = 'sticker';
    case System = 'system';

    public function isMedia(): bool
    {
        return in_array($this, [self::Image, self::Video, self::Audio, self::Document, self::Sticker]);
    }
}
