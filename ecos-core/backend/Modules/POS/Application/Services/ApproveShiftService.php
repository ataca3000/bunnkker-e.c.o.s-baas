<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\ApproveShiftCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\ShiftNotFoundException;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;

final class ApproveShiftService
{
    public function __construct(
        private readonly ShiftRepositoryInterface $shiftRepo,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(ApproveShiftCommand $command): void
    {
        $shift = $this->shiftRepo->findById($command->shiftId);

        if ($shift === null) {
            throw ShiftNotFoundException::withId($command->shiftId);
        }

        $expectedClosing = Money::of($command->expectedClosingAmount, $command->expectedClosingCurrency);

        $shift->approve($expectedClosing);
        $this->shiftRepo->save($shift);

        $this->publisher->publishAll($shift->pullDomainEvents());
    }
}
