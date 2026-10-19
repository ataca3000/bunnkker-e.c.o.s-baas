<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RaiseExceptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_assignment_id' => ['nullable', 'uuid'],
            'exception_type' => ['required', 'string', 'max:100'],
            'severity' => ['required', 'in:low,medium,critical'],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'entity_type' => ['nullable', 'string', 'max:50'],
            'entity_id' => ['nullable', 'uuid'],
        ];
    }
}
