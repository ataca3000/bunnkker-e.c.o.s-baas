<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RecalculateWaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'add_order_ids' => ['nullable', 'array'],
            'add_order_ids.*' => ['uuid'],
            'remove_order_ids' => ['nullable', 'array'],
            'remove_order_ids.*' => ['uuid'],
        ];
    }
}
