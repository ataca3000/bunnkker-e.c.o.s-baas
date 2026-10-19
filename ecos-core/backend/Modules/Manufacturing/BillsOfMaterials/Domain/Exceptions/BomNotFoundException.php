<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions;

use Exception;

final class BomNotFoundException extends Exception
{
    public function __construct(string $id)
    {
        parent::__construct("Bill of Materials [{$id}] not found.");
    }
}
