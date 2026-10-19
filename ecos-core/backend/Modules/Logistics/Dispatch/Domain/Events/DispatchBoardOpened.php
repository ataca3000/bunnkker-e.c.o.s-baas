<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;

/**
 * A board was opened for an origin and date.
 */
class DispatchBoardOpened
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly DispatchBoard $board,
        public readonly ?string $actor = null,
    ) {}
}
