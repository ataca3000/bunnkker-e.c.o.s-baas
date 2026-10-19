<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AssignDriverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'driver_id' => ['required', 'uuid'],
            'driver_name' => ['required', 'string', 'max:255'],
            'driver_phone' => ['nullable', 'string', 'max:50'],
            'assignment_type' => ['nullable', 'in:primary,substitute'],
            'departure_time_planned' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
