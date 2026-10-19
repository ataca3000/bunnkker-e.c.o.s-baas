<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Modules\POS\Application\Commands\OpenSessionCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SessionAlreadyOpenException;
use Modules\POS\Application\Results\OpenSessionResult;
use Modules\POS\Application\Services\OpenSessionService;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Events\SessionOpened;
use Modules\POS\Session\Domain\Models\Session;
use Tests\TestCase;

final class OpenSessionServiceTest extends TestCase
{
    private SessionRepositoryInterface $sessionRepo;

    private DomainEventPublisherInterface $publisher;

    private OpenSessionService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sessionRepo = $this->createMock(SessionRepositoryInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->service = new OpenSessionService($this->sessionRepo, $this->publisher);
    }

    public function test_throws_when_cashier_already_has_open_session(): void
    {
        $this->sessionRepo
            ->method('hasOpenSessionForCashier')
            ->willReturn(true);

        $this->expectException(SessionAlreadyOpenException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_saves_session_when_no_conflict(): void
    {
        $this->sessionRepo
            ->method('hasOpenSessionForCashier')
            ->willReturn(false);

        $this->sessionRepo
            ->expects($this->once())
            ->method('save')
            ->with($this->isInstanceOf(Session::class));

        $this->publisher->expects($this->once())->method('publishAll');

        $this->service->execute($this->makeCommand());
    }

    public function test_returns_result_with_session_id(): void
    {
        $this->sessionRepo->method('hasOpenSessionForCashier')->willReturn(false);
        $this->sessionRepo->method('save')->willReturnCallback(function (Session $s) {
            $s->id = 'sess-uuid';
        });
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertInstanceOf(OpenSessionResult::class, $result);
        $this->assertNotEmpty($result->sessionId);
    }

    public function test_publishes_session_opened_event(): void
    {
        $this->sessionRepo->method('hasOpenSessionForCashier')->willReturn(false);
        $this->sessionRepo->method('save')->willReturnCallback(function (Session $s) {
            $s->id = 'sess-uuid';
        });

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(function (array $events) {
                return count($events) === 1 && $events[0] instanceof SessionOpened;
            }));

        $this->service->execute($this->makeCommand());
    }

    private function makeCommand(): OpenSessionCommand
    {
        return new OpenSessionCommand(
            cashierId: 'cashier-uuid-1',
            companyId: 'company-uuid-1',
            channelId: null,
            warehouseId: 'warehouse-uuid-1',
            deviceFingerprint: 'fp-abc123',
            ipAddress: '192.168.1.1',
            deviceType: 'browser',
        );
    }
}
