<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposal;

/**
 * A dispatcher accepted the proposal.
 */
class DispatchProposalAccepted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly DispatchProposal $proposal,
        public readonly ?string $actor = null,
    ) {}
}
