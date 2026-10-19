<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when a provider's App Secret is rotated.
 * Contains no secret material — only metadata.has_app_secret flag.
 */
final class ProviderCredentialRotated extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.credential_rotated';
    }
}
