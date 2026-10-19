<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** A customer-service refusal, rendered as a 422 with an actionable message. */
class ServiceException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }

    public static function invalidTransition(string $from, string $to): self
    {
        return new self("A ticket cannot move from {$from} to {$to}.");
    }

    public static function ticketTerminal(string $number): self
    {
        return new self("Ticket {$number} is closed or cancelled and cannot be changed.");
    }
}
