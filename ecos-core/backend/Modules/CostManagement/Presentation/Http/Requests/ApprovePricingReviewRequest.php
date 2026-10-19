<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApprovePricingReviewRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(['approve_suggested', 'keep_current', 'custom_price', 'reject'])],
            'custom_price' => ['required_if:action,custom_price', 'nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'manager_name' => ['nullable', 'string', 'max:255'],
            'channels' => ['nullable', 'array'],
            'channels.*' => [Rule::in(['pos', 'website', 'wholesale', 'marketplace'])],
        ];
    }
}
