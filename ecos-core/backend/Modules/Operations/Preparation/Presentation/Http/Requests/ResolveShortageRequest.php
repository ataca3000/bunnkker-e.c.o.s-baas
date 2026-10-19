<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ResolveShortageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'requirement_ids' => ['nullable', 'array'],
            'requirement_ids.*' => ['uuid'],
            'resolution_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
