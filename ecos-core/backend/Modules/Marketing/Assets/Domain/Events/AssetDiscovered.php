<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Events;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;

final class AssetDiscovered
{
    public function __construct(
        public readonly MarketingAsset $asset,
        public readonly string $connectionId,
        public readonly bool $isNew,         // false = updated existing
    ) {}
}
