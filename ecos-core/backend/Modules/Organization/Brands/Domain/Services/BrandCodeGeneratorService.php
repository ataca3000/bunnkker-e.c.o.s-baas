<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Services;

use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;

/**
 * Generates sequential brand codes in the format BRD-000001.
 * The sequence is per-company; each company has its own counter.
 */
final class BrandCodeGeneratorService
{
    public function __construct(private readonly BrandRepositoryInterface $brands) {}

    public function next(string $companyId): string
    {
        $number = $this->brands->nextCodeNumber($companyId);

        return sprintf('BRD-%06d', $number);
    }
}
