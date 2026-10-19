<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class ProductMappingNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Product mapping [{$id}] not found.");
    }
}
