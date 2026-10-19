<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever any company-level setting is created or updated.
 * AI Platform and downstream modules subscribe to this event.
 */
final class ConfigurationChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $companyId,
        public readonly string $module,
        public readonly string $category,
        public readonly ?string $key = null,
    ) {}
}
