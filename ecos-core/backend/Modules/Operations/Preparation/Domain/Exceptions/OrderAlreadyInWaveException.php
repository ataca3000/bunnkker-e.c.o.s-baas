<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Exceptions;

use RuntimeException;

final class OrderAlreadyInWaveException extends RuntimeException
{
    /** @param string[] $orderIds */
    public function __construct(public readonly array $orderIds)
    {
        $list = implode(', ', $orderIds);
        parent::__construct(
            "The following order(s) are already assigned to another preparation wave: [{$list}]. "
            .'Each order may only belong to one preparation wave per company.',
        );
    }
}
