<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Services;

/**
 * Per-process company context for queue workers.
 *
 * Queue workers have no HTTP request, so $app['request']->user() is null.
 * Jobs that need to resolve provider credentials MUST set the company ID
 * on this singleton before invoking any provider-scoped service, and MUST
 * clear it in a finally block to avoid leaking context to the next job on
 * the same process.
 *
 * Usage in a job:
 *
 *   public function handle(ProviderCredentialContext $ctx): void
 *   {
 *       $ctx->set($this->companyId);
 *       try {
 *           // MetaApiClient / MetaConnector resolve correctly here
 *       } finally {
 *           $ctx->clear();
 *       }
 *   }
 */
final class ProviderCredentialContext
{
    private ?string $companyId = null;

    public function set(string $companyId): void
    {
        $this->companyId = $companyId;
    }

    public function get(): ?string
    {
        return $this->companyId;
    }

    public function clear(): void
    {
        $this->companyId = null;
    }
}
