<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Enums;

/**
 * The outcome of processing a business event through the posting pipeline.
 *
 *   posted     — a new journal was written
 *   duplicate  — the event was already posted; the existing journal was returned
 *   skipped    — the event has no financial impact (no rule); nothing posted
 *   previewed  — a dry run; the journal was shaped but not written
 *   failed     — the event could not post and was dead-lettered
 */
enum PostingResult: string
{
    case Posted = 'posted';
    case Duplicate = 'duplicate';
    case Skipped = 'skipped';
    case Previewed = 'previewed';
    case Failed = 'failed';

    public function isSuccessful(): bool
    {
        return $this === self::Posted || $this === self::Duplicate;
    }
}
