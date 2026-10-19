<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when provider credential validation fails.
 * metadata.errors contains the humanized error messages (no secrets).
 */
final class ProviderValidationFailed extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.validation_failed';
    }
}
