<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Modules\Sales\Customers\Domain\Models\Customer;
use Throwable;

final class CustomerSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly Channel $channel,
        private readonly Customer $customer,
    ) {}

    public function handle(SyncLogService $logService): void
    {
        $log = $logService->createLog(
            $this->channel,
            SyncEntityType::Customer,
            SyncDirection::Outbound,
            'customer.sync',
            $this->customer->id,
            SyncStatus::Processing,
            ['customer_id' => $this->customer->id, 'email' => $this->customer->email],
        );

        $credential = $this->channel->credential;

        if ($credential === null) {
            $logService->markFailed($log, 'No credentials configured for this channel.');

            return;
        }

        $payload = $this->buildPayload();
        $baseUrl = rtrim($this->channel->store_url, '/').'/wp-json/wc/v3/customers';

        try {
            $wcCustomerId = $this->resolveWooCommerceCustomerId($baseUrl, $credential->consumer_key, $credential->consumer_secret);

            if ($wcCustomerId !== null) {
                $response = Http::withBasicAuth($credential->consumer_key, $credential->consumer_secret)
                    ->timeout(15)
                    ->put("{$baseUrl}/{$wcCustomerId}", $payload);
            } else {
                $response = Http::withBasicAuth($credential->consumer_key, $credential->consumer_secret)
                    ->timeout(15)
                    ->post($baseUrl, $payload);
            }

            if ($response->successful()) {
                $logService->markSuccess($log, ['wc_customer_id' => $response->json('id')], $this->channel);
            } else {
                $logService->markFailed($log, "HTTP {$response->status()}: ".substr($response->body(), 0, 500), null, $this->channel);
            }
        } catch (Throwable $e) {
            $logService->markFailed($log, $e->getMessage(), null, $this->channel);
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(): array
    {
        $nameParts = explode(' ', trim($this->customer->name), 2);
        $firstName = $nameParts[0] ?? '';
        $lastName = $nameParts[1] ?? '';

        $billingShipping = [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone' => $this->customer->phone ?? $this->customer->mobile ?? '',
            'email' => $this->customer->email ?? '',
            'address_1' => $this->customer->address ?? '',
            'city' => $this->customer->city ?? '',
            'country' => $this->customer->country ?? '',
        ];

        return [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $this->customer->email ?? '',
            'billing' => $billingShipping,
            'shipping' => $billingShipping,
        ];
    }

    private function resolveWooCommerceCustomerId(string $baseUrl, string $key, string $secret): ?int
    {
        if ($this->customer->email === null) {
            return null;
        }

        try {
            $response = Http::withBasicAuth($key, $secret)
                ->timeout(10)
                ->get($baseUrl, ['email' => $this->customer->email]);

            if ($response->successful()) {
                $customers = $response->json();
                if (is_array($customers) && isset($customers[0]['id'])) {
                    return (int) $customers[0]['id'];
                }
            }
        } catch (Throwable) {
        }

        return null;
    }
}
