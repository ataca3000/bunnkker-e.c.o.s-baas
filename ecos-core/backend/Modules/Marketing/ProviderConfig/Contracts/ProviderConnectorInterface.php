<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Contracts;

interface ProviderConnectorInterface
{
    /** Machine-readable provider key, e.g. "meta", "google_ads". */
    public function getProviderKey(): string;

    /** Human-readable display name. */
    public function getDisplayName(): string;

    /**
     * Returns the default OAuth redirect URI for this provider.
     * The returned URI must be registered in the provider's developer console.
     */
    public function getDefaultRedirectUri(): string;
}
