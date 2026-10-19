<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Services;

use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;

/**
 * Aggregated result from BulkWorkflowEngine.
 *
 * @property-read array<string, FulfillmentResult> $succeeded  orderId → FulfillmentResult
 * @property-read array<string, string>            $failed     orderId → error message
 */
final class BulkWorkflowResult
{
    /**
     * @param  array<string, FulfillmentResult>  $succeeded
     * @param  array<string, string>  $failed
     */
    public function __construct(
        public readonly array $succeeded,
        public readonly array $failed,
    ) {}

    public function totalProcessed(): int
    {
        return count($this->succeeded) + count($this->failed);
    }

    public function successCount(): int
    {
        return count($this->succeeded);
    }

    public function failureCount(): int
    {
        return count($this->failed);
    }

    public function hasFailures(): bool
    {
        return ! empty($this->failed);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'total' => $this->totalProcessed(),
            'succeeded' => $this->successCount(),
            'failed' => $this->failureCount(),
            'errors' => $this->failed,
        ];
    }
}
