<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OverrideAllocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'allocation_record_id' => ['required', 'uuid'],
            'new_quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
            'actor_type' => ['required', 'in:dispatcher,driver'],
        ];
    }
}
