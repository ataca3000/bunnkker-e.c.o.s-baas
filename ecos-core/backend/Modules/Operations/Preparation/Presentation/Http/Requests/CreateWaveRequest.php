<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CreateWaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'planning_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['required', 'uuid'],
            'brand_id' => ['nullable', 'uuid', 'exists:brands,id'],
            'channel_id' => ['nullable', 'uuid', 'exists:sales_channels,id'],
            'delivery_window_id' => ['nullable', 'uuid'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
