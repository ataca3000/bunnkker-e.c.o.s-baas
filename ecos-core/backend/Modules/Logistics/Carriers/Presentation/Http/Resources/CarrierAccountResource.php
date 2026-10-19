<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\Models\CarrierCapability;

/**
 * @mixin CarrierAccount
 *
 * provider_reference is NEVER serialised — it points into the Provider
 * Platform's encrypted credential store and is hidden on the model.
 */
class CarrierAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,

            'adapter_key' => $this->adapter_key,
            'code' => $this->code,
            'name' => $this->name,
            'mode' => $this->mode,
            'is_internal' => $this->isInternal(),
            'status' => $this->status,
            'is_active' => $this->isActive(),
            'is_default' => $this->is_default,
            'priority' => $this->priority,

            // Whether credentials exist — never the credentials themselves.
            'has_credentials' => $this->hasCredentials(),

            // LOG-001 by reference. Null for the internal own-fleet carrier.
            'shipping_company_id' => $this->shipping_company_id,
            'shipping_company' => $this->whenLoaded(
                'shippingCompany',
                fn () => $this->shippingCompany === null ? null : [
                    'id' => $this->shippingCompany->id,
                    'name' => $this->shippingCompany->name,
                ],
            ),

            'capabilities' => $this->whenLoaded('capabilities', fn () => $this->capabilities->map(
                static fn (CarrierCapability $capability) => [
                    'capability' => $capability->capability,
                    'is_supported' => $capability->is_supported,
                    'absence_meaning' => $capability->is_supported
                        ? null
                        : $capability->absenceMeaning(),
                    'constraints' => $capability->constraints,
                ]
            )->all()),

            'status_mapping_count' => $this->when(
                $this->relationLoaded('statusMappings'),
                fn () => $this->statusMappings->count(),
            ),

            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
