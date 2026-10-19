<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CancelSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ];
    }
}
