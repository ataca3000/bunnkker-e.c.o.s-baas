<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

/** @mixin BusinessAccount */
final class BusinessAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn (): array => [
                'id' => $this->company->id,
                'code' => $this->company->code,
                'name' => $this->company->name,
            ]),
            'brand_id' => $this->brand_id,
            'brand' => $this->whenLoaded('brand', function (): ?array {
                if ($this->brand === null) {
                    return null;
                }

                return [
                    'id' => $this->brand->id,
                    'code' => $this->brand->code,
                    'name' => $this->brand->name,
                ];
            }),
            'code' => $this->code,
            'name' => $this->name,
            'provider' => $this->provider,
            'status' => $this->status,
            'description' => $this->description,
            'logo' => $this->logo,
            'oauth_config' => $this->oauth_config,
            'api_keys' => $this->api_keys,
            'webhook_config' => $this->webhook_config,
            'sync_settings' => $this->sync_settings,
            'external_metadata' => $this->external_metadata,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
