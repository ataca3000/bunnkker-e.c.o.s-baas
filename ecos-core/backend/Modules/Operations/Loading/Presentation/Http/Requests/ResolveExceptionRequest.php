<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ResolveExceptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'resolution_notes' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }
}
