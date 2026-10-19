<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Events;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class PermissionChanged
{
    /**
     * @param  list<string>  $granted
     * @param  list<string>  $missing
     */
    public function __construct(
        public readonly MarketingConnection $connection,
        public readonly array $granted,
        public readonly array $missing,
        public readonly bool $isValid,
    ) {}
}
