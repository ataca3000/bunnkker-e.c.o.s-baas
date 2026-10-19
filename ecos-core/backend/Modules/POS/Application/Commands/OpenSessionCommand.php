<?php

declare(strict_types=1);

namespace Modules\POS\Application\Commands;

final readonly class OpenSessionCommand
{
    public function __construct(
        public string $cashierId,
        public string $companyId,
        public ?string $channelId,
        public string $warehouseId,
        public string $deviceFingerprint,
        public string $ipAddress,
        public string $deviceType = 'browser',
    ) {}
}
