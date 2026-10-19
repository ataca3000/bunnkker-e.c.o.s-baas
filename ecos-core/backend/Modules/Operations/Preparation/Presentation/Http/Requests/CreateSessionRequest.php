<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CreateSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'warehouse_id' => ['required', 'uuid'],
            'planning_date' => ['required', 'date_format:Y-m-d'],
            'operator_id' => ['required', 'uuid'],
            'supervisor_id' => ['nullable', 'uuid'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
