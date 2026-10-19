<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Domain\Services;

use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;

/**
 * Generates sequential business-account codes in the format BA-000001.
 * The sequence is per-company; each company has its own counter.
 */
final class BusinessAccountCodeGeneratorService
{
    public function __construct(private readonly BusinessAccountRepositoryInterface $accounts) {}

    public function next(string $companyId): string
    {
        $number = $this->accounts->nextCodeNumber($companyId);

        return sprintf('BA-%06d', $number);
    }
}
