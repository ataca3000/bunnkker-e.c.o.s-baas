<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AddWaveToSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'wave_id' => ['required', 'uuid'],
        ];
    }
}
