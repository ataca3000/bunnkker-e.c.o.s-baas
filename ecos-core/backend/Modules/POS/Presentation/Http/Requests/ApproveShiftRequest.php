<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ApproveShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'expected_closing' => ['required', 'array'],
            'expected_closing.amount' => ['required', 'numeric', 'min:0'],
            'expected_closing.currency' => ['required', 'string', 'size:3'],
        ];
    }
}
