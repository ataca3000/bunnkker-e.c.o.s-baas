<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\ChannelProviders;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Modules\CustomerEngagement\Application\Contracts\ChannelProviderContract;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;

class InstagramProvider implements ChannelProviderContract
{
    private const API_VERSION = 'v21.0';

    private const BASE_URL = 'https://graph.facebook.com';

    public function __construct(private readonly ChannelProvider $config) {}

    public function channel(): string
    {
        return 'instagram_direct';
    }

    private function accessToken(): string
    {
        return $this->config->getCredential('access_token') ?? '';
    }

    private function sendUrl(): string
    {
        return self::BASE_URL.'/'.self::API_VERSION.'/me/messages?access_token='.$this->accessToken();
    }

    public function sendMessage(string $recipientId, string $text, array $options = []): array
    {
        $payload = ['recipient' => ['id' => $recipientId], 'message' => ['text' => $text]];
        $response = Http::post($this->sendUrl(), $payload)->throw()->json();

        return ['provider_message_id' => $response['message_id'] ?? null, 'sent_at' => now()->toIso8601String()];
    }

    public function sendTemplate(string $recipientId, string $templateName, string $languageCode, array $components = []): array
    {
        // Instagram doesn't support Meta message templates; send as text
        return $this->sendMessage($recipientId, $templateName);
    }

    public function sendMedia(string $recipientId, string $mediaType, string $mediaUrl, ?string $caption = null): array
    {
        $attachmentType = match ($mediaType) {
            'image' => 'image',
            'video' => 'video',
            default => 'file',
        };

        $payload = [
            'recipient' => ['id' => $recipientId],
            'message' => [
                'attachment' => [
                    'type' => $attachmentType,
                    'payload' => ['url' => $mediaUrl],
                ],
            ],
        ];

        $response = Http::post($this->sendUrl(), $payload)->throw()->json();

        return ['provider_message_id' => $response['message_id'] ?? null, 'sent_at' => now()->toIso8601String()];
    }

    public function markAsRead(string $providerMessageId): bool
    {
        Http::post($this->sendUrl(), [
            'recipient' => ['id' => $providerMessageId],
            'sender_action' => 'mark_seen',
        ]);

        return true;
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
            foreach ($entry['messaging'] ?? [] as $event) {
                $senderId = $event['sender']['id'] ?? null;
                $msg = $event['message'] ?? null;

                if (! $msg || ! $senderId) {
                    continue;
                }

                // Story replies and reel replies — detected via referral
                $msgType = 'text';
                $referral = $msg['attachments'][0]['payload'] ?? null;
                if ($referral && isset($referral['reel_video_id'])) {
                    $msgType = 'reel_reply';
                } elseif ($referral && isset($referral['story_id'])) {
                    $msgType = 'story_reply';
                } elseif (! empty($msg['attachments'])) {
                    $msgType = $msg['attachments'][0]['type'] ?? 'document';
                }

                $messages[] = [
                    'conversation_id' => $senderId,
                    'message_id' => $msg['mid'],
                    'sender_id' => $senderId,
                    'sender_name' => null,
                    'sender_phone' => null,
                    'message_type' => $msgType,
                    'content' => $msg['text'] ?? null,
                    'media_url' => $msg['attachments'][0]['payload']['url'] ?? null,
                    'media_type' => $msg['attachments'][0]['type'] ?? null,
                    'reply_to_message_id' => $msg['reply_to']['mid'] ?? null,
                    'reaction_emoji' => $event['reaction']['reaction'] ?? null,
                    'timestamp' => (int) round(($event['timestamp'] ?? time() * 1000) / 1000),
                    'attribution' => null,
                ];
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
