<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Exceptions;

use RuntimeException;

final class BrandNotFoundException extends RuntimeException
{
    public function __construct(string $id = '')
    {
        parent::__construct($id !== '' ? "Brand [{$id}] not found." : 'Brand not found.');
    }
}
