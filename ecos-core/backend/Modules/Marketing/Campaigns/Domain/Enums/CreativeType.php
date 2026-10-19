<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum CreativeType: string
{
    case Image = 'image';
    case Video = 'video';
    case Carousel = 'carousel';
    case Collection = 'collection';
    case Story = 'story';
    case Reel = 'reel';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Image => 'Image',
            self::Video => 'Video',
            self::Carousel => 'Carousel',
            self::Collection => 'Collection',
            self::Story => 'Story',
            self::Reel => 'Reel',
            self::Other => 'Other',
        };
    }
}
