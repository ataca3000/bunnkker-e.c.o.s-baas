<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\ChannelProviders;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Modules\CustomerEngagement\Application\Contracts\ChannelProviderContract;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;

class WhatsAppProvider implements ChannelProviderContract
{
    private const API_VERSION = 'v21.0';

    private const BASE_URL = 'https://graph.facebook.com';

    public function __construct(private readonly ChannelProvider $config) {}

    public function channel(): string
    {
        return 'whatsapp';
    }

    private function endpoint(string $path): string
    {
        $phoneNumberId = $this->config->getCredential('phone_number_id');

        return self::BASE_URL.'/'.self::API_VERSION.'/'.$phoneNumberId.$path;
    }

    private function accessToken(): string
    {
        return $this->config->getCredential('access_token') ?? '';
    }

    public function sendMessage(string $recipientId, string $text, array $options = []): array
    {
        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $recipientId,
            'type' => 'text',
            'text' => ['body' => $text, 'preview_url' => $options['preview_url'] ?? false],
        ];

        if (! empty($options['reply_to_message_id'])) {
            $payload['context'] = ['message_id' => $options['reply_to_message_id']];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->endpoint('/messages'), $payload)
            ->throw()
            ->json();

        return [
            'provider_message_id' => $response['messages'][0]['id'] ?? null,
            'sent_at' => now()->toIso8601String(),
        ];
    }

    public function sendTemplate(string $recipientId, string $templateName, string $languageCode, array $components = []): array
    {
        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $recipientId,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $languageCode],
                'components' => $components,
            ],
        ];

        $response = Http::withToken($this->accessToken())
            ->post($this->endpoint('/messages'), $payload)
            ->throw()
            ->json();

        return [
            'provider_message_id' => $response['messages'][0]['id'] ?? null,
            'sent_at' => now()->toIso8601String(),
        ];
    }

    public function sendMedia(string $recipientId, string $mediaType, string $mediaUrl, ?string $caption = null): array
    {
        $mediaBody = ['link' => $mediaUrl];
        if ($caption && in_array($mediaType, ['image', 'video', 'document'])) {
            $mediaBody['caption'] = $caption;
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $recipientId,
            'type' => $mediaType,
            $mediaType => $mediaBody,
        ];

        $response = Http::withToken($this->accessToken())
            ->post($this->endpoint('/messages'), $payload)
            ->throw()
            ->json();

        return [
            'provider_message_id' => $response['messages'][0]['id'] ?? null,
            'sent_at' => now()->toIso8601String(),
        ];
    }

    public function markAsRead(string $providerMessageId): bool
    {
        $response = Http::withToken($this->accessToken())
            ->post($this->endpoint('/messages'), [
                'messaging_product' => 'whatsapp',
                'status' => 'read',
                'message_id' => $providerMessageId,
            ]);

        return $response->successful();
    }

    public function validateWebhook(Request $request, string $webhookSecret): bool
    {
        $signature = $request->header('X-Hub-Signature-256', '');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $webhookSecret);

        return hash_equals($expected, $signature);
    }

    public function parseInboundWebhook(array $payload): array
    {
        $messages = [];

        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                if ($change['field'] !== 'messages') {
                    continue;
                }

                $value = $change['value'];

                foreach ($value['messages'] ?? [] as $msg) {
                    $attribution = null;
                    if (! empty($msg['referral'])) {
                        $ref = $msg['referral'];
                        $attribution = [
                            'ad_id' => $ref['ad_id'] ?? null,
                            'click_id' => $ref['ctwa_clid'] ?? null,
                            'source' => $ref['source_type'] ?? null,
                        ];
                    }

                    $contact = $value['contacts'][0] ?? [];
                    $messages[] = [
                        'conversation_id' => $msg['from'],           // phone = thread ID for WhatsApp
                        'message_id' => $msg['id'],
                        'sender_id' => $msg['from'],
                        'sender_name' => $contact['profile']['name'] ?? null,
                        'sender_phone' => $msg['from'],
                        'message_type' => $msg['type'] ?? 'text',
                        'content' => $msg['text']['body'] ?? null,
                        'media_url' => $msg[$msg['type'] ?? '']['id'] ?? null,
                        'media_type' => $msg['type'] !== 'text' ? $msg['type'] : null,
                        'reply_to_message_id' => $msg['context']['id'] ?? null,
                        'reaction_emoji' => $msg['reaction']['emoji'] ?? null,
                        'timestamp' => (int) ($msg['timestamp'] ?? time()),
                        'attribution' => $attribution,
                    ];
                }

                // Handle status updates (delivered / read)
                foreach ($value['statuses'] ?? [] as $status) {
                    $messages[] = [
                        '__status_update__' => true,
                        'message_id' => $status['id'],
                        'delivery_status' => $status['status'],
                        'timestamp' => (int) ($status['timestamp'] ?? time()),
                    ];
                }
            }
        }

        return $messages;
    }

    public function handleVerificationChallenge(Request $request, string $verifyToken): ?string
    {
        if ($request->query('hub_mode') === 'subscribe' && $request->query('hub_verify_token') === $verifyToken) {
            return $request->query('hub_challenge');
        }

        return null;
    }
}
