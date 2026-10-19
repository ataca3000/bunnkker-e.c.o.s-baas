<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\CloseSessionCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SessionNotFoundException;
use Modules\POS\Application\Exceptions\ShiftStillOpenException;
use Modules\POS\Application\Results\CloseSessionResult;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;

final class CloseSessionService
{
    public function __construct(
        private readonly SessionRepositoryInterface $sessionRepo,
        private readonly DomainEventPublisherInterface $publisher,
        private readonly ?ShiftRepositoryInterface $shiftRepo = null,
    ) {}

    public function execute(CloseSessionCommand $command): CloseSessionResult
    {
        $session = $this->sessionRepo->findById($command->sessionId);

        if ($session === null) {
            throw SessionNotFoundException::withId($command->sessionId);
        }

        if ($this->shiftRepo !== null && $this->shiftRepo->findOpenBySession($command->sessionId) !== null) {
            throw ShiftStillOpenException::forSession($command->sessionId);
        }

        $session->pullDomainEvents(); // discard events accumulated at construction (already published when session opened)
        $session->close();
        $this->sessionRepo->save($session);

        $this->publisher->publishAll($session->pullDomainEvents());

        return new CloseSessionResult((string) $session->id);
    }
}
