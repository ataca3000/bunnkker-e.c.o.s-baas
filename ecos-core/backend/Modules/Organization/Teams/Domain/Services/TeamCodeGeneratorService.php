<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Domain\Services;

use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;

/**
 * Generates sequential team codes in the format TM-000001.
 * The sequence is per-company; each company has its own counter.
 */
final class TeamCodeGeneratorService
{
    public function __construct(private readonly TeamRepositoryInterface $teams) {}

    public function next(string $companyId): string
    {
        $number = $this->teams->nextCodeNumber($companyId);

        return sprintf('TM-%06d', $number);
    }
}
