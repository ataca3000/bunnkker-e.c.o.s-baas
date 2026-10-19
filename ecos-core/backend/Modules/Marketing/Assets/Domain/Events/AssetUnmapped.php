<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Events;

final class AssetUnmapped
{
    public function __construct(
        public readonly string $assetId,
        public readonly string $relatedType,
        public readonly string $relatedId,
        public readonly string $actorId,
    ) {}
}
