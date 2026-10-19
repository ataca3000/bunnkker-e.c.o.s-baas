<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StartPreparationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'worker_ids' => ['nullable', 'array'],
            'worker_ids.*' => ['uuid', 'exists:users,id'],
            'supervisor_id' => ['nullable', 'uuid', 'exists:users,id'],
            'station_ids' => ['nullable', 'array'],
            'station_ids.*' => ['uuid', 'exists:preparation_stations,id'],
            'override_shortage' => ['boolean'],
        ];
    }
}
