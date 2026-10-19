<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;

/**
 * An assignment cannot proceed; its blockers explain why.
 */
class DispatchBlocked
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly DispatchProposedAssignment $assignment,
        public readonly ?string $actor = null,
    ) {}
}
