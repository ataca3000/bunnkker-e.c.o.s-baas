<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Application\Services\MetaWebhookService;
use Modules\Marketing\MetaConnector\Domain\Models\MetaWebhook;

/**
 * Meta Webhook Management + Incoming Delivery Handler.
 */
final class MetaWebhookController extends Controller
{
    public function __construct(
        private readonly MetaWebhookService $webhookService,
    ) {}

    // ── Management ────────────────────────────────────────────────────────────

    /**
     * GET /marketing/meta/connections/{connection}/webhooks
     */
    public function index(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $webhooks = $this->webhookService->listForConnection($connection);

        return response()->json([
            'webhooks' => $webhooks->map(fn (MetaWebhook $w) => [
                'id' => $w->id,
                'object_type' => $w->object_type,
                'object_id' => $w->object_id,
                'status' => $w->status,
                'subscribed_fields' => $w->subscribed_fields,
                'verified_at' => $w->verified_at?->toISOString(),
                'last_delivery_at' => $w->last_delivery_at?->toISOString(),
                'last_error' => $w->last_error,
                'retry_count' => $w->retry_count,
                'created_at' => $w->created_at?->toISOString(),
            ])->values(),
        ]);
    }

    /**
     * POST /marketing/meta/connections/{connection}/webhooks/register-all
     *
     * Register all standard webhook subscriptions for this connection.
     */
    public function registerAll(Request $request, string $connectionId): JsonResponse
    {
        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $this->webhookService->registerAll($connection);

        return response()->json(['message' => 'Webhooks registration dispatched.']);
    }

    /**
     * POST /marketing/meta/connections/{connection}/webhooks
     *
     * Register a single webhook subscription.
     */
    public function register(Request $request, string $connectionId): JsonResponse
    {
        $request->validate([
            'object_type' => ['required', 'string'],
            'object_id' => ['nullable', 'string'],
            'fields' => ['required', 'array'],
            'fields.*' => ['string'],
        ]);

        $connection = $this->resolveConnection($request, $connectionId);
        if ($connection === null) {
            return response()->json(['message' => 'Connection not found.'], 404);
        }

        $webhook = $this->webhookService->register(
            connection: $connection,
            objectType: $request->string('object_type')->toString(),
            objectId: $request->string('object_id')->toString() ?: null,
            fields: $request->input('fields'),
        );

        return response()->json([
            'message' => 'Webhook registered.',
            'id' => $webhook->id,
            'status' => $webhook->status,
        ], 201);
    }

    /**
     * DELETE /marketing/meta/webhooks/{webhook}
     *
     * Remove a webhook subscription.
     */
    public function remove(Request $request, string $webhookId): JsonResponse
    {
        $webhook = MetaWebhook::where('id', $webhookId)
            ->whereHas('connection', fn ($q) => $q->where('company_id', (string) $request->user()->company_id))
            ->with('connection')
            ->first();

        if ($webhook === null) {
            return response()->json(['message' => 'Webhook not found.'], 404);
        }

        $this->webhookService->remove($webhook, $webhook->connection);

        return response()->json(['message' => 'Webhook removed.']);
    }

    /**
     * POST /marketing/meta/webhooks/{webhook}/re-register
     *
     * Re-register a failed or inactive webhook.
     */
    public function reRegister(Request $request, string $webhookId): JsonResponse
    {
        $webhook = MetaWebhook::where('id', $webhookId)
            ->whereHas('connection', fn ($q) => $q->where('company_id', (string) $request->user()->company_id))
            ->with('connection')
            ->first();

        if ($webhook === null) {
            return response()->json(['message' => 'Webhook not found.'], 404);
        }

        $newWebhook = $this->webhookService->reRegister($webhook, $webhook->connection);

        return response()->json([
            'message' => 'Webhook re-registered.',
            'id' => $newWebhook->id,
            'status' => $newWebhook->status,
        ]);
    }

    // ── Incoming Meta Events ──────────────────────────────────────────────────

    /**
     * GET /marketing/meta/webhook
     *
     * Meta hub-mode challenge verification.
     * Called by Meta when registering or re-verifying a webhook subscription.
     *
     * Meta sends: hub.mode=subscribe, hub.challenge=<random>, hub.verify_token=<token>
     */
    public function verify(Request $request): Response|JsonResponse
    {
        $mode = $request->query('hub_mode') ?? $request->query('hub.mode');
        $challenge = $request->query('hub_challenge') ?? $request->query('hub.challenge');
        $verifyToken = $request->query('hub_verify_token') ?? $request->query('hub.verify_token');

        if ($mode !== 'subscribe' || empty($challenge) || empty($verifyToken)) {
            return response()->json(['message' => 'Invalid verification request.'], 400);
        }

        // objectType is not present in the challenge — scan all pending_verification webhooks
        // and return the challenge if ANY match the verify_token
        $matched = $this->webhookService->verifyChallenge(
            objectType: 'any',
            mode: (string) $mode,
            challenge: (string) $challenge,
            verifyToken: (string) $verifyToken,
        );

        if ($matched === null) {
            Log::warning('MetaWebhookController: no webhook matched verify_token');

            return response()->json(['message' => 'Verification failed.'], 403);
        }

        // Respond with challenge as plain text (Meta requirement)
        return response($matched, 200)->header('Content-Type', 'text/plain');
    }

    /**
     * POST /marketing/meta/webhook
     *
     * Incoming Meta event delivery.
     * Meta sends event batches; we record delivery and dispatch async processing.
     */
    public function receive(Request $request): JsonResponse
    {
        // Verify Meta's HMAC-SHA256 signature before touching the payload.
        // Meta sends X-Hub-Signature-256: sha256=<hmac> on every delivery.
        $rawBody = $request->getContent();
        $signature = $request->header('X-Hub-Signature-256', '');

        if (! $this->webhookService->verifyWebhookSignature($rawBody, $signature)) {
            Log::warning('MetaWebhook: signature verification failed', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Signature verification failed.'], 403);
        }

        $payload = $request->all();

        if (empty($payload)) {
            return response()->json(['message' => 'Empty payload.'], 400);
        }

        $object = $payload['object'] ?? 'unknown';
        $entries = $payload['entry'] ?? [];
        $entryCount = count($entries);

        Log::info('Meta webhook received', [
            'object' => $object,
            'entry_count' => $entryCount,
        ]);

        // Record delivery on the matching webhook record
        $this->webhookService->recordDelivery($object);

        // Dispatch async processing — the actual event routing is handled by
        // domain listeners. We ack immediately (Meta requirement: respond within 5 sec).
        // TODO: dispatch MetaWebhookEventJob when domain processing is wired up

        return response()->json(['message' => 'OK'], 200);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolveConnection(Request $request, string $connectionId): ?MarketingConnection
    {
        return MarketingConnection::where('id', $connectionId)
            ->where('company_id', (string) $request->user()->company_id)
            ->where('connector_type', ConnectorType::Meta->value)
            ->first();
    }
}
