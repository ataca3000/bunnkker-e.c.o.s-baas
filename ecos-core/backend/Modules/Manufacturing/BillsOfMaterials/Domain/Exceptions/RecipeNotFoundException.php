<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions;

use RuntimeException;

final class RecipeNotFoundException extends RuntimeException
{
    public function __construct(string $identifier)
    {
        parent::__construct("Recipe [{$identifier}] not found.");
    }
}
