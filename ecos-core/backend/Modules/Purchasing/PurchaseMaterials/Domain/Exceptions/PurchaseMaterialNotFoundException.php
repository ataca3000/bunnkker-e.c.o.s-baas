<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class PurchaseMaterialNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Purchase material [{$id}] not found.");
    }
}
