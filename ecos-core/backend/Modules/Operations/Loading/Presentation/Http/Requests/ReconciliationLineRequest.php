<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ReconciliationLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quantity_returned_actual' => ['required', 'numeric', 'min:0'],
            'resolution_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
