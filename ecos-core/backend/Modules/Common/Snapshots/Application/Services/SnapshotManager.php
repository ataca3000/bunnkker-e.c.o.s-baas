<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Modules\Common\Snapshots\Application\Builders\BusinessContextSnapshotBuilder;
use Modules\Common\Snapshots\Application\Builders\FinancialSnapshotBuilder;
use Modules\Common\Snapshots\Application\Validators\SnapshotValidator;
use Modules\Common\Snapshots\Domain\Contracts\BusinessContextProvider;
use Modules\Common\Snapshots\Domain\Contracts\FinancialSnapshotProvider;
use Modules\Common\Snapshots\Domain\Contracts\SnapshotPersistenceAdapter;
use Modules\Common\Snapshots\Domain\DTOs\FinancialSnapshotDTO;
use Modules\Common\Snapshots\Domain\Events\SnapshotCreated;
use Modules\Common\Snapshots\Domain\Events\SnapshotLocked;
use Modules\Common\Snapshots\Domain\Timeline\SnapshotTimelineBuilder;

/**
 * Platform orchestrator for snapshot creation.
 *
 * Sequence:
 *  1. Validate financial provider (throws SnapshotConsistencyException on failure)
 *  2. DB transaction:
 *     a. Business context persisted (WHY)
 *     b. Financial snapshot persisted (WHAT)
 *     c. Timeline events logged inside the same transaction
 *  3. Platform events fired OUTSIDE the transaction (listeners see committed data)
 *
 * The module-specific SnapshotPersistenceAdapter handles all Eloquent writes.
 * SnapshotManager is completely module-agnostic.
 */
final class SnapshotManager
{
    public function __construct(
        private readonly SnapshotValidator $validator,
        private readonly BusinessContextSnapshotBuilder $contextBuilder,
        private readonly FinancialSnapshotBuilder $financialBuilder,
        private readonly SnapshotTimelineBuilder $timelineBuilder,
    ) {}

    /**
     * Create both context and financial snapshots within a single DB transaction.
     *
     * Returns the FinancialSnapshotDTO so callers can access the UUID, hash, etc.
     * Returns null if both snapshots already exist (idempotent; no error).
     *
     * @throws \Modules\Common\Snapshots\Domain\Exceptions\SnapshotConsistencyException
     */
    public function createFor(
        BusinessContextProvider $contextProvider,
        FinancialSnapshotProvider $financialProvider,
        SnapshotPersistenceAdapter $persistence,
        ?string $actorId = null,
    ): ?FinancialSnapshotDTO {
        // Already fully created — idempotent guard
        if ($persistence->businessContextExists() && $persistence->financialSnapshotExists()) {
            return null;
        }

        // Validate before we touch the DB
        $this->validator->validateConsistency($financialProvider);

        // Build DTOs (pure computation, no I/O)
        $contextDto = $this->contextBuilder->build($contextProvider);
        $financialDto = $this->financialBuilder->build($financialProvider);

        // Persist inside a single transaction
        DB::transaction(function () use ($contextDto, $financialDto, $persistence, $actorId, $contextProvider, $financialProvider): void {
            if (! $persistence->businessContextExists()) {
                $persistence->persistBusinessContext($contextDto, $actorId);

                $timelineEntry = $this->timelineBuilder->businessContextCaptured(
                    $contextProvider->getSnapshotAggregateId(),
                    $contextProvider->getBrandName(),
                    $contextProvider->getChannelName(),
                    $contextProvider->getPriceSource(),
                );
                $persistence->logSnapshotEvent(
                    $timelineEntry['type'],
                    $timelineEntry['description'],
                    $timelineEntry['metadata'],
                    $actorId,
                );
            }

            if (! $persistence->financialSnapshotExists()) {
                $persistence->persistFinancialSnapshot($financialDto, $actorId);

                $timelineEntry = $this->timelineBuilder->financialSnapshotCreated(
                    $financialProvider->getSnapshotAggregateId(),
                    $financialDto->aggregateId,
                    $financialDto->snapshotUuid,
                    $financialDto->grandTotal,
                    $financialDto->integrityHash,
                );
                $persistence->logSnapshotEvent(
                    $timelineEntry['type'],
                    $timelineEntry['description'],
                    $timelineEntry['metadata'],
                    $actorId,
                );
            }
        });

        // Fire platform events OUTSIDE the transaction
        $now = now()->toIso8601String();

        Event::dispatch(new SnapshotCreated(
            snapshotUuid: $financialDto->snapshotUuid,
            snapshotType: 'business_context',
            aggregateType: $contextDto->aggregateType,
            aggregateId: $contextDto->aggregateId,
            companyId: $financialProvider->getSnapshotCompanyId(),
            brandId: $financialDto->brandId,
            channelId: $financialDto->channelId,
            timestamp: $now,
        ));

        Event::dispatch(new SnapshotCreated(
            snapshotUuid: $financialDto->snapshotUuid,
            snapshotType: 'financial',
            aggregateType: $financialDto->aggregateType,
            aggregateId: $financialDto->aggregateId,
            companyId: $financialProvider->getSnapshotCompanyId(),
            brandId: $financialDto->brandId,
            channelId: $financialDto->channelId,
            timestamp: $now,
        ));

        Event::dispatch(new SnapshotLocked(
            snapshotUuid: $financialDto->snapshotUuid,
            aggregateType: $financialDto->aggregateType,
            aggregateId: $financialDto->aggregateId,
            companyId: $financialProvider->getSnapshotCompanyId(),
            grandTotal: $financialDto->grandTotal,
            grossProfit: $financialDto->grossProfit,
            actualMarginPercent: $financialDto->actualMarginPercent,
            marginStatus: $financialDto->marginStatus,
            integrityHash: $financialDto->integrityHash,
            lockedAt: $now,
        ));

        return $financialDto;
    }
}
