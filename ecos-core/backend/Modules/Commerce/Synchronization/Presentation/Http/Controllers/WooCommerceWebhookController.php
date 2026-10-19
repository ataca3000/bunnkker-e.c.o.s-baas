<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessCustomerWebhookJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessOrderWebhookJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProcessProductWebhookJob;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;

final class WooCommerceWebhookController extends Controller
{
    use HasApiResponse;

    public function handleOrder(Request $request, Channel $channel, SyncLogService $logService): JsonResponse
    {
        if (! $this->verifySignature($request, $channel)) {
            $this->logRejection($channel, $logService, SyncEntityType::Order);

            return $this->error('Invalid or missing webhook signature.', 401);
        }

        $channel->update(['last_webhook_received_at' => now()]);

        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();

        $topic = is_string($request->header('X-WC-Webhook-Topic')) ? $request->header('X-WC-Webhook-Topic') : 'order.webhook';
        $externalOrderId = (string) ($payload['id'] ?? '');

        if ($externalOrderId !== '' && $this->isDuplicate($channel->id, $externalOrderId, $topic)) {
            $logService->createSkippedLog(
                $channel,
                SyncEntityType::Order,
                SyncDirection::Inbound,
                'duplicate_webhook',
                $externalOrderId,
                ['topic' => $topic, 'external_order_id' => $externalOrderId],
            );

            return $this->success(null, 'Duplicate webhook detected, skipped.');
        }

        ProcessOrderWebhookJob::dispatch($channel, $payload, $topic);

        return $this->success(null, 'Webhook received.');
    }

    public function handleProduct(Request $request, Channel $channel, SyncLogService $logService): JsonResponse
    {
        if (! $this->verifySignature($request, $channel)) {
            $this->logRejection($channel, $logService, SyncEntityType::Product);

            return $this->error('Invalid or missing webhook signature.', 401);
        }

        $channel->update(['last_webhook_received_at' => now()]);

        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();
        $topic = is_string($request->header('X-WC-Webhook-Topic')) ? $request->header('X-WC-Webhook-Topic') : 'product.webhook';
        $externalId = (string) ($payload['id'] ?? '');

        if ($externalId !== '' && $this->isDuplicate($channel->id, $externalId, $topic)) {
            $logService->createSkippedLog(
                $channel,
                SyncEntityType::Product,
                SyncDirection::Inbound,
                'duplicate_webhook',
                $externalId,
                ['topic' => $topic, 'external_product_id' => $externalId],
            );

            return $this->success(null, 'Duplicate webhook detected, skipped.');
        }

        ProcessProductWebhookJob::dispatch($channel, $payload, $topic);

        return $this->success(null, 'Webhook received.');
    }

    public function handleCustomer(Request $request, Channel $channel, SyncLogService $logService): JsonResponse
    {
        if (! $this->verifySignature($request, $channel)) {
            $this->logRejection($channel, $logService, SyncEntityType::Customer);

            return $this->error('Invalid or missing webhook signature.', 401);
        }

        $channel->update(['last_webhook_received_at' => now()]);

        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();
        $topic = is_string($request->header('X-WC-Webhook-Topic')) ? $request->header('X-WC-Webhook-Topic') : 'customer.webhook';
        $externalId = (string) ($payload['id'] ?? '');

        if ($externalId !== '' && $this->isDuplicate($channel->id, $externalId, $topic)) {
            $logService->createSkippedLog(
                $channel,
                SyncEntityType::Customer,
                SyncDirection::Inbound,
                'duplicate_webhook',
                $externalId,
                ['topic' => $topic, 'external_customer_id' => $externalId],
            );

            return $this->success(null, 'Duplicate webhook detected, skipped.');
        }

        ProcessCustomerWebhookJob::dispatch($channel, $payload, $topic);

        return $this->success(null, 'Webhook received.');
    }

    private function verifySignature(Request $request, Channel $channel): bool
    {
        $signature = $request->header('X-WC-Webhook-Signature');

        if (! is_string($signature) || $signature === '') {
            return false;
        }

        $credential = $channel->credential;

        if ($credential === null) {
            return false;
        }

        $rawBody = $request->getContent();
        $expected = base64_encode(hash_hmac('sha256', $rawBody, $credential->consumer_secret, true));

        return hash_equals($expected, $signature);
    }

    private function isDuplicate(string $channelId, string $externalId, string $topic): bool
    {
        $key = "wc_webhook:{$channelId}:{$externalId}:{$topic}";

        return ! Cache::add($key, true, 300);
    }

    private function logRejection(Channel $channel, SyncLogService $logService, SyncEntityType $entityType): void
    {
        $logService->createSkippedLog(
            $channel,
            $entityType,
            SyncDirection::Inbound,
            'signature_rejected',
            null,
            ['reason' => 'invalid or missing X-WC-Webhook-Signature'],
        );
    }
}
