<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** A customer-domain refusal, rendered as a 422 with an actionable message. */
class CustomerException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }

    public static function businessNameRequired(): self
    {
        return new self('A business customer requires a business name.');
    }

    public static function individualNameRequired(): self
    {
        return new self('An individual customer requires a first or last name.');
    }

    public static function cannotMergeIntoSelf(): self
    {
        return new self('A customer cannot be merged into itself.');
    }

    public static function crossCompanyMerge(): self
    {
        return new self('Customers of different companies cannot be merged.');
    }

    public static function alreadyArchived(string $name): self
    {
        return new self("Customer {$name} is already archived.");
    }

    public static function cannotMergeArchived(): self
    {
        return new self('An already-merged or archived customer cannot be the survivor of a merge.');
    }
}
