<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;

final class PatchOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $statuses = array_column(OrderStatus::cases(), 'value');

        return [
            'status' => ['sometimes', 'string', Rule::in($statuses)],
            'area' => ['sometimes', 'nullable', 'string', 'max:255'],
            'governorate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'google_maps_lat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'google_maps_lng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'google_maps_url' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
