<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class ChannelNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Channel [{$id}] not found.");
    }
}
