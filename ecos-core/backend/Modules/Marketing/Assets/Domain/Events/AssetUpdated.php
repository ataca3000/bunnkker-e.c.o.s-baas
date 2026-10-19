<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Events;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;

final class AssetUpdated
{
    /** @param array<string, mixed> $changes */
    public function __construct(
        public readonly MarketingAsset $asset,
        public readonly array $changes,
    ) {}
}
