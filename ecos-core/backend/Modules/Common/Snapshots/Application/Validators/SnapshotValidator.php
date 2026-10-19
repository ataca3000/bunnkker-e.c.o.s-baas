<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Application\Validators;

use Modules\Common\Snapshots\Domain\Contracts\FinancialSnapshotProvider;
use Modules\Common\Snapshots\Domain\Exceptions\SnapshotConsistencyException;

/**
 * Validates aggregate data before a financial snapshot is created.
 *
 * Throws SnapshotConsistencyException for any constraint violation.
 * Orders no longer validate directly — they pass a provider here.
 */
final class SnapshotValidator
{
    /**
     * @throws SnapshotConsistencyException
     */
    public function validateConsistency(FinancialSnapshotProvider $provider): void
    {
        $this->assertGrandTotalPositive($provider);
        $this->assertCurrencyPresent($provider);
        $this->assertLinesNotEmpty($provider);
        $this->assertAggregateIdentityComplete($provider);
    }

    private function assertGrandTotalPositive(FinancialSnapshotProvider $provider): void
    {
        if ($provider->getGrandTotal() <= 0.0) {
            throw new SnapshotConsistencyException(
                'Snapshot grand_total must be positive. '
                ."Aggregate: {$provider->getSnapshotAggregateType()} {$provider->getSnapshotAggregateId()}",
            );
        }
    }

    private function assertCurrencyPresent(FinancialSnapshotProvider $provider): void
    {
        if (trim((string) $provider->getCurrency()) === '') {
            throw new SnapshotConsistencyException(
                'Snapshot currency must not be empty. '
                ."Aggregate: {$provider->getSnapshotAggregateType()} {$provider->getSnapshotAggregateId()}",
            );
        }
    }

    private function assertLinesNotEmpty(FinancialSnapshotProvider $provider): void
    {
        if (count($provider->getLineItems()) === 0) {
            throw new SnapshotConsistencyException(
                'Snapshot must contain at least one line item. '
                ."Aggregate: {$provider->getSnapshotAggregateType()} {$provider->getSnapshotAggregateId()}",
            );
        }
    }

    private function assertAggregateIdentityComplete(FinancialSnapshotProvider $provider): void
    {
        if (trim($provider->getSnapshotAggregateId()) === '') {
            throw new SnapshotConsistencyException('Snapshot aggregate_id must not be empty.');
        }

        if (trim($provider->getSnapshotAggregateType()) === '') {
            throw new SnapshotConsistencyException('Snapshot aggregate_type must not be empty.');
        }
    }
}
