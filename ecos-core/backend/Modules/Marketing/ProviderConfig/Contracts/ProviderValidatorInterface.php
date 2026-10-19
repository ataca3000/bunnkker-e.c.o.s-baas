<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Contracts;

interface ProviderValidatorInterface
{
    /**
     * Validates App ID + App Secret against the provider's live API.
     *
     * Implementations MUST NOT store or log the secret in any form.
     *
     * @return array{valid: bool, errors: list<string>}
     */
    public function validate(string $appId, string $appSecret): array;
}
