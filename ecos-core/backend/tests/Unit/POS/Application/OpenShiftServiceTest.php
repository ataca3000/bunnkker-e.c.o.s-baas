<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Modules\POS\Application\Commands\OpenShiftCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SessionNotFoundException;
use Modules\POS\Application\Exceptions\ShiftAlreadyOpenException;
use Modules\POS\Application\Results\OpenShiftResult;
use Modules\POS\Application\Services\OpenShiftService;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Events\ShiftOpened;
use Modules\POS\Shift\Domain\Models\Shift;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use Tests\TestCase;

final class OpenShiftServiceTest extends TestCase
{
    private SessionRepositoryInterface $sessionRepo;

    private ShiftRepositoryInterface $shiftRepo;

    private DomainEventPublisherInterface $publisher;

    private OpenShiftService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sessionRepo = $this->createMock(SessionRepositoryInterface::class);
        $this->shiftRepo = $this->createMock(ShiftRepositoryInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->service = new OpenShiftService($this->sessionRepo, $this->shiftRepo, $this->publisher);
    }

    public function test_throws_when_session_not_found(): void
    {
        $this->sessionRepo->method('findById')->willReturn(null);

        $this->expectException(SessionNotFoundException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_throws_when_session_has_open_shift(): void
    {
        $this->sessionRepo->method('findById')->willReturn($this->makeSession());
        $this->shiftRepo->method('findOpenBySession')
            ->willReturn(Shift::open('sess-1', 'term-1', 'cashier-1', Money::of('100', 'EGP'), ShiftNumber::of(1)));

        $this->expectException(ShiftAlreadyOpenException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_opens_shift_and_saves(): void
    {
        $this->sessionRepo->method('findById')->willReturn($this->makeSession());
        $this->shiftRepo->method('findOpenBySession')->willReturn(null);
        $this->shiftRepo->method('countByTerminal')->willReturn(0);
        $this->shiftRepo->expects($this->once())->method('save')->with($this->isInstanceOf(Shift::class));
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand());
    }

    public function test_shift_number_is_count_plus_one(): void
    {
        $this->sessionRepo->method('findById')->willReturn($this->makeSession());
        $this->shiftRepo->method('findOpenBySession')->willReturn(null);
        $this->shiftRepo->method('countByTerminal')->willReturn(4);

        $savedShift = null;
        $this->shiftRepo->method('save')->willReturnCallback(function (Shift $s) use (&$savedShift) {
            $s->id = 'shift-uuid';
            $savedShift = $s;
        });
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertSame(5, $result->shiftNumber);
    }

    public function test_returns_result(): void
    {
        $this->sessionRepo->method('findById')->willReturn($this->makeSession());
        $this->shiftRepo->method('findOpenBySession')->willReturn(null);
        $this->shiftRepo->method('countByTerminal')->willReturn(0);
        $this->shiftRepo->method('save')->willReturnCallback(fn (Shift $s) => $s->id = 'shift-uuid');
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertInstanceOf(OpenShiftResult::class, $result);
        $this->assertSame(1, $result->shiftNumber);
    }

    public function test_publishes_shift_opened_event(): void
    {
        $this->sessionRepo->method('findById')->willReturn($this->makeSession());
        $this->shiftRepo->method('findOpenBySession')->willReturn(null);
        $this->shiftRepo->method('countByTerminal')->willReturn(0);
        $this->shiftRepo->method('save')->willReturnCallback(fn (Shift $s) => $s->id = 'shift-uuid');

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(fn (array $events) => count($events) === 1 && $events[0] instanceof ShiftOpened,
            ));

        $this->service->execute($this->makeCommand());
    }

    private function makeSession(): Session
    {
        $s = Session::open('cashier-1', 'company-1', null, 'warehouse-1', DeviceFingerprint::of('fp'), '127.0.0.1', DeviceType::Browser);
        $s->id = 'sess-1';

        return $s;
    }

    private function makeCommand(): OpenShiftCommand
    {
        return new OpenShiftCommand(
            sessionId: 'sess-1',
            terminalId: 'term-1',
            cashierId: 'cashier-1',
            openingCashAmount: '500.00',
            openingCashCurrency: 'EGP',
        );
    }
}
