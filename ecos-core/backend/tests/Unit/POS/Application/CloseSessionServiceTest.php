<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Modules\POS\Application\Commands\CloseSessionCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SessionNotFoundException;
use Modules\POS\Application\Results\CloseSessionResult;
use Modules\POS\Application\Services\CloseSessionService;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Events\SessionClosed;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Tests\TestCase;

final class CloseSessionServiceTest extends TestCase
{
    private SessionRepositoryInterface $sessionRepo;

    private DomainEventPublisherInterface $publisher;

    private CloseSessionService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sessionRepo = $this->createMock(SessionRepositoryInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->service = new CloseSessionService($this->sessionRepo, $this->publisher);
    }

    public function test_throws_when_session_not_found(): void
    {
        $this->sessionRepo->method('findById')->willReturn(null);

        $this->expectException(SessionNotFoundException::class);

        $this->service->execute(new CloseSessionCommand('no-session', 'cashier-1'));
    }

    public function test_closes_session_and_saves(): void
    {
        $session = Session::open('cashier-1', 'company-1', null, 'warehouse-1', DeviceFingerprint::of('fp'), '127.0.0.1', DeviceType::Browser);
        $session->id = 'sess-1';

        $this->sessionRepo->method('findById')->willReturn($session);
        $this->sessionRepo->expects($this->once())->method('save')->with($session);
        $this->publisher->method('publishAll');

        $this->service->execute(new CloseSessionCommand('sess-1', 'cashier-1'));
    }

    public function test_returns_result(): void
    {
        $session = Session::open('cashier-1', 'company-1', null, 'warehouse-1', DeviceFingerprint::of('fp'), '127.0.0.1', DeviceType::Browser);
        $session->id = 'sess-1';

        $this->sessionRepo->method('findById')->willReturn($session);
        $this->sessionRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute(new CloseSessionCommand('sess-1', 'cashier-1'));

        $this->assertInstanceOf(CloseSessionResult::class, $result);
        $this->assertSame('sess-1', $result->sessionId);
    }

    public function test_publishes_session_closed_event(): void
    {
        $session = Session::open('cashier-1', 'company-1', null, 'warehouse-1', DeviceFingerprint::of('fp'), '127.0.0.1', DeviceType::Browser);
        $session->id = 'sess-1';

        $this->sessionRepo->method('findById')->willReturn($session);
        $this->sessionRepo->method('save');

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(function (array $events) {
                return count($events) === 1 && $events[0] instanceof SessionClosed;
            }));

        $this->service->execute(new CloseSessionCommand('sess-1', 'cashier-1'));
    }
}
