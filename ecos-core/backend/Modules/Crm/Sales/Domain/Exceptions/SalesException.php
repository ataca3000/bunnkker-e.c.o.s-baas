<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** A sales-domain refusal, rendered as a 422. */
class SalesException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }

    public static function leadAlreadyConverted(string $name): self
    {
        return new self("Lead {$name} is already converted.");
    }

    public static function opportunityClosed(string $name): self
    {
        return new self("Opportunity {$name} is already won or lost.");
    }

    public static function quoteNotEditable(): self
    {
        return new self('Only a draft quote can be edited.');
    }
}
