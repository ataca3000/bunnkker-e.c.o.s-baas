<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Events;

use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;

final class AssetMapped
{
    public function __construct(
        public readonly MarketingAssetRelationship $relationship,
        public readonly string $actorId,
        public readonly bool $isAutoSuggested,
    ) {}
}
