<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;

/**
 * @mixin UserPreference
 */
final class UserPreferenceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'category' => $this->category,
            'payload' => $this->payload,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
