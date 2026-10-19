<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

final class ConnectionResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'connector_type' => $this->connector_type,
            'label' => $this->label,
            'status' => $this->status,
            'external_account_id' => $this->external_account_id,
            'scopes' => $this->scopes,
            'required_scopes' => $this->required_scopes,
            'is_token_expired' => $this->isTokenExpired(),
            'is_token_expiring_soon' => $this->isTokenExpiringSoon(),
            'token_expires_at' => $this->token_expires_at?->toIso8601String(),
            'permissions_validated_at' => $this->permissions_validated_at?->toIso8601String(),
            'last_validated_at' => $this->last_validated_at?->toIso8601String(),
            'connected_by' => $this->connected_by,
            'disconnected_at' => $this->disconnected_at?->toIso8601String(),
            'disconnected_by' => $this->disconnected_by,
            'connector_meta' => $this->connector_meta,
            'assets_count' => $this->whenCounted('assets'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
