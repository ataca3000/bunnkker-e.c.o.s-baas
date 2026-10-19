<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Application\Actions;

use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class CancelCountSessionAction
{
    public function execute(InventoryCountSession $session): InventoryCountSession
    {
        if (! $session->status->canTransitionTo(CountSessionStatus::Cancelled)) {
            throw new UnprocessableEntityHttpException(
                "Count session [{$session->count_number}] cannot be cancelled from status [{$session->status->value}].",
            );
        }

        $session->update(['status' => CountSessionStatus::Cancelled]);

        return $session->refresh();
    }
}
