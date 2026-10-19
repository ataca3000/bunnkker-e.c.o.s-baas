<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Exceptions;

use Modules\Common\Snapshots\Domain\Exceptions\SnapshotConsistencyException as PlatformSnapshotConsistencyException;

/**
 * Thrown when an order's financial totals are internally inconsistent
 * before snapshot creation. Prevents corrupt data from being locked.
 *
 * Extends the platform base class so test code catching this exception continues
 * to work even though validation now runs in the platform SnapshotValidator.
 */
class SnapshotConsistencyException extends PlatformSnapshotConsistencyException {}
