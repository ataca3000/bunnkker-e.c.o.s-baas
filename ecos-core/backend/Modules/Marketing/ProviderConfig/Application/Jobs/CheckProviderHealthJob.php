<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialContext;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;

/**
 * Background health check for a single company + provider pair.
 *
 * Company context ($companyId) is serialized explicitly in the constructor
 * so the job works correctly in queue workers where there is no HTTP request.
 *
 * Dispatch:
 *   CheckProviderHealthJob::dispatch($companyId, 'meta')->onQueue('health');
 */
final class CheckProviderHealthJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 30;

    public function __construct(
        private readonly string $companyId,
        private readonly string $provider,
    ) {}

    public function handle(ProviderHealthMonitor $monitor, ProviderCredentialContext $context): void
    {
        // Set explicit company context so MetaApiClient / MetaConnector resolve
        // the correct credentials when there is no authenticated HTTP request.
        $context->set($this->companyId);

        try {
            $monitor->invalidate($this->companyId, $this->provider);
            $monitor->check($this->companyId, $this->provider);
        } finally {
            $context->clear();
        }
    }
}
