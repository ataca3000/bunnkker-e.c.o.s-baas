<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown when a snapshot's financial totals are internally inconsistent.
 * Prevents corrupt data from being locked into an immutable snapshot.
 *
 * Orders\SnapshotConsistencyException extends this class for backward compatibility.
 */
class SnapshotConsistencyException extends RuntimeException {}
