<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Modules\POS\Application\Commands\CloseShiftCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\ShiftNotFoundException;
use Modules\POS\Application\Results\CloseShiftResult;
use Modules\POS\Application\Services\CloseShiftService;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Events\ShiftSubmittedForClosure;
use Modules\POS\Shift\Domain\Models\Shift;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use Tests\TestCase;

final class CloseShiftServiceTest extends TestCase
{
    private ShiftRepositoryInterface $shiftRepo;

    private DomainEventPublisherInterface $publisher;

    private CloseShiftService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shiftRepo = $this->createMock(ShiftRepositoryInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->service = new CloseShiftService($this->shiftRepo, $this->publisher);
    }

    public function test_throws_when_shift_not_found(): void
    {
        $this->shiftRepo->method('findById')->willReturn(null);

        $this->expectException(ShiftNotFoundException::class);

        $this->service->execute(new CloseShiftCommand('no-shift', '0.00', 'EGP'));
    }

    public function test_submits_shift_for_closure(): void
    {
        $shift = $this->makeShift();
        $this->shiftRepo->method('findById')->willReturn($shift);
        $this->shiftRepo->expects($this->once())->method('save')->with($shift);
        $this->publisher->method('publishAll');

        $this->service->execute(new CloseShiftCommand('shift-1', '480.00', 'EGP'));
    }

    public function test_returns_result(): void
    {
        $shift = $this->makeShift();
        $this->shiftRepo->method('findById')->willReturn($shift);
        $this->shiftRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute(new CloseShiftCommand('shift-1', '480.00', 'EGP'));

        $this->assertInstanceOf(CloseShiftResult::class, $result);
        $this->assertSame('shift-1', $result->shiftId);
    }

    public function test_publishes_shift_submitted_event(): void
    {
        $shift = $this->makeShift();
        $this->shiftRepo->method('findById')->willReturn($shift);
        $this->shiftRepo->method('save');

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(fn (array $events) => count($events) === 1 && $events[0] instanceof ShiftSubmittedForClosure,
            ));

        $this->service->execute(new CloseShiftCommand('shift-1', '480.00', 'EGP'));
    }

    private function makeShift(): Shift
    {
        $shift = Shift::open('sess-1', 'term-1', 'cashier-1', Money::of('500.00', 'EGP'), ShiftNumber::of(1));
        $shift->id = 'shift-1';
        $shift->session_id = 'sess-1';
        $shift->terminal_id = 'term-1';
        $shift->cashier_id = 'cashier-1';

        return $shift;
    }
}
