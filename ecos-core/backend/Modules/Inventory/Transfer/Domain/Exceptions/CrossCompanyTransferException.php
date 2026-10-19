<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Domain\Exceptions;

use RuntimeException;

final class CrossCompanyTransferException extends RuntimeException
{
    public function __construct(string $sourceCompanyId, string $destCompanyId)
    {
        parent::__construct(
            "Cross-company transfer is forbidden. Source company [{$sourceCompanyId}] ≠ destination company [{$destCompanyId}].",
        );
    }
}
