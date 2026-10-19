<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\RejectShiftCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\ShiftNotFoundException;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;

final class RejectShiftService
{
    public function __construct(
        private readonly ShiftRepositoryInterface $shiftRepo,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(RejectShiftCommand $command): void
    {
        $shift = $this->shiftRepo->findById($command->shiftId);

        if ($shift === null) {
            throw ShiftNotFoundException::withId($command->shiftId);
        }

        $shift->rejectCount($command->reason);
        $this->shiftRepo->save($shift);

        $this->publisher->publishAll($shift->pullDomainEvents());
    }
}
