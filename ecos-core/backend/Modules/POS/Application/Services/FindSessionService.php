<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\SessionNotFoundException;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Models\Session;

final class FindSessionService
{
    public function __construct(
        private readonly SessionRepositoryInterface $sessionRepo,
    ) {}

    public function execute(string $sessionId): Session
    {
        $session = $this->sessionRepo->findById($sessionId);

        if ($session === null) {
            throw SessionNotFoundException::withId($sessionId);
        }

        return $session;
    }
}
