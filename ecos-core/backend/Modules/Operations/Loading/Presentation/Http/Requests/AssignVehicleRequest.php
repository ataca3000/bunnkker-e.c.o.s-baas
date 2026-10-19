<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AssignVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'uuid'],
            'vehicle_registration' => ['required', 'string', 'max:50'],
            'vehicle_type' => ['required', 'string', 'max:50'],
            'capacity_weight_kg' => ['required', 'numeric', 'min:0'],
            'capacity_volume_m3' => ['required', 'numeric', 'min:0'],
            'refrigerated' => ['boolean'],
            'vehicle_plan_slot_id' => ['nullable', 'uuid'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
