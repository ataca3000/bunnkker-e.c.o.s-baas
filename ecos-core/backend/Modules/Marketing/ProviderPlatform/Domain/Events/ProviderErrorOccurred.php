<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * General-purpose error event for provider failures not covered by specific events.
 * metadata.error_class and metadata.error_message carry the sanitized error.
 * Never include stack traces or raw API responses.
 */
final class ProviderErrorOccurred extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.error_occurred';
    }
}
