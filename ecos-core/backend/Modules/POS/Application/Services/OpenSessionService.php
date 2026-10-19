<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\OpenSessionCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SessionAlreadyOpenException;
use Modules\POS\Application\Results\OpenSessionResult;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;

final class OpenSessionService
{
    public function __construct(
        private readonly SessionRepositoryInterface $sessionRepo,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(OpenSessionCommand $command): OpenSessionResult
    {
        if ($this->sessionRepo->hasOpenSessionForCashier($command->cashierId)) {
            throw SessionAlreadyOpenException::forCashier($command->cashierId);
        }

        $session = Session::open(
            cashierId: $command->cashierId,
            companyId: $command->companyId,
            channelId: $command->channelId,
            warehouseId: $command->warehouseId,
            fingerprint: DeviceFingerprint::of($command->deviceFingerprint),
            ipAddress: $command->ipAddress,
            deviceType: DeviceType::from($command->deviceType),
        );

        $this->sessionRepo->save($session);
        $this->publisher->publishAll($session->pullDomainEvents());

        return new OpenSessionResult((string) $session->id);
    }
}
