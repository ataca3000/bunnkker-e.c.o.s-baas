<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever a brand-level policy group is created or updated.
 * Subscribers: AI Platform, Preparation OS (if preparation group), Pricing OS, etc.
 */
final class BrandPolicyUpdated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $brandId,
        public readonly string $companyId,
        public readonly string $policyGroup,
        public readonly array $settings,
    ) {}
}
