<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdatePoolQualityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'quality_result' => ['required', 'string', 'in:passed,failed'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
