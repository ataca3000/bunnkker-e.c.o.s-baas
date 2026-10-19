<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Services;

use Illuminate\Support\Facades\Http;
use Modules\Marketing\ProviderConfig\Contracts\ProviderValidatorInterface;
use Throwable;

/**
 * Validates Meta App credentials against the Graph API without storing them.
 *
 * Uses the Client Credentials grant to obtain an App Access Token,
 * which proves the App ID + Secret combination is valid.
 */
final class MetaConfigValidator implements ProviderValidatorInterface
{
    private const TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';

    /**
     * @return array{valid: bool, errors: list<string>}
     */
    public function validate(string $appId, string $appSecret): array
    {
        if (empty($appId)) {
            return ['valid' => false, 'errors' => ['App ID is required.']];
        }

        if (empty($appSecret)) {
            return ['valid' => false, 'errors' => ['App Secret is required.']];
        }

        try {
            $response = Http::timeout(10)->get(self::TOKEN_URL, [
                'client_id' => $appId,
                'client_secret' => $appSecret,
                'grant_type' => 'client_credentials',
            ]);

            if ($response->successful() && ! empty($response->json('access_token'))) {
                return ['valid' => true, 'errors' => []];
            }

            $errorMsg = $response->json('error.message', 'Unknown error');
            $errorCode = $response->json('error.code', 0);
            $errorType = $response->json('error.type', '');

            return ['valid' => false, 'errors' => [$this->humanizeError($errorCode, $errorType, $errorMsg)]];
        } catch (Throwable $e) {
            return ['valid' => false, 'errors' => ['Cannot reach Meta API. Please check your internet connection and try again.']];
        }
    }

    private function humanizeError(int $code, string $type, string $message): string
    {
        return match ($code) {
            101 => 'Invalid App ID. Please verify your Meta App ID in the Meta Developer Console.',
            190 => 'Invalid App Secret. Please verify your App Secret in the Meta Developer Console.',
            100 => 'Invalid parameter — check that your App ID and Secret are correct.',
            default => "Meta API error ({$type} #{$code}): {$message}",
        };
    }
}
