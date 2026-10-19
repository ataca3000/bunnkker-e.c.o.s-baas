<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ReprintReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'cashier_id' => ['required', 'string', 'uuid'],
            'terminal_id' => ['required', 'string', 'uuid'],
            'reason' => ['required', 'string', 'max:500'],
        ];
    }
}
