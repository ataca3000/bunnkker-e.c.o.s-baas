<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Operations\Preparation\Domain\Enums\PreparationIssueType;

final class ReportIssueRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'issue_type' => ['required', Rule::enum(PreparationIssueType::class)],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'entity_type' => ['nullable', 'string', 'max:50'],
            'entity_id' => ['nullable', 'uuid'],
        ];
    }
}
