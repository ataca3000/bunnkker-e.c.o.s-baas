<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMaterialCostRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'material_cost' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }
}
