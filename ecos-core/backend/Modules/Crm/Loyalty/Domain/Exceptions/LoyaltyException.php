<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** A loyalty-domain refusal, rendered as a 422. */
class LoyaltyException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }

    public static function insufficientPoints(int $have, int $need): self
    {
        return new self("Insufficient points: balance {$have}, required {$need}.");
    }

    public static function accountSuspended(): self
    {
        return new self('This loyalty account is suspended.');
    }

    public static function rewardUnavailable(string $name): self
    {
        return new self("Reward {$name} is inactive or out of stock.");
    }

    public static function mustBePositive(): self
    {
        return new self('Points amount must be greater than zero.');
    }
}
