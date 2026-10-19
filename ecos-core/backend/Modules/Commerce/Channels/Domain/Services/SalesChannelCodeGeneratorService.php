<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Commerce\Channels\Domain\Models\Channel;

final class SalesChannelCodeGeneratorService
{
    public function next(string $brandId): string
    {
        return DB::transaction(function () use ($brandId): string {
            $count = Channel::withTrashed()
                ->where('brand_id', $brandId)
                ->lockForUpdate()
                ->count();

            return sprintf('CH-%06d', $count + 1);
        });
    }
}
