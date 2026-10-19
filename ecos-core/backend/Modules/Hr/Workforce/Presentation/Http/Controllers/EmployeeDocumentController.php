<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Workforce\Domain\Models\EmployeeDocument;
use Modules\Hr\Workforce\Domain\Services\EmployeeDocumentService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Documents attached to an employee, and the expiry watchlist. */
class EmployeeDocumentController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly EmployeeDocumentService $documents) {}

    public function index(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);

        $rows = $employee->documents()->orderByDesc('created_at')->get()
            ->map(fn (EmployeeDocument $d) => $this->payload($d));

        return response()->json(['data' => $rows]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $days = min(365, max(1, (int) $request->integer('days', 60)));
        $rows = $this->documents->expiringWithin($this->companyId($request), $days)
            ->map(fn (EmployeeDocument $d) => $this->payload($d) + [
                'employee' => $d->employee === null ? null : [
                    'id' => $d->employee->id,
                    'name' => $d->employee->fullName(),
                    'employee_number' => $d->employee->employee_number,
                ],
            ]);

        return response()->json(['data' => ['days' => $days, 'items' => $rows]]);
    }

    public function store(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'type' => ['required', 'string', 'max:40'],
            'title' => ['required', 'string', 'max:200'],
            'file_path' => ['nullable', 'string', 'max:400'],
            'file_name' => ['nullable', 'string', 'max:200'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'file_size' => ['nullable', 'integer', 'min:0'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:400'],
        ]);

        $document = $this->documents->attach($this->employee($request, $employeeId), $v, $this->actorId($request));

        return response()->json(['data' => $this->payload($document)], 201);
    }

    public function destroy(Request $request, string $employeeId, string $id): JsonResponse
    {
        $this->employee($request, $employeeId);

        $document = EmployeeDocument::query()
            ->where('company_id', $this->companyId($request))
            ->where('employee_id', $employeeId)
            ->where('id', $id)
            ->firstOrFail();

        $this->documents->remove($document);

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** @return array<string, mixed> */
    private function payload(EmployeeDocument $document): array
    {
        return [
            'id' => $document->id,
            'employee_id' => $document->employee_id,
            'type' => $document->type->value,
            'type_label' => $document->type->label(),
            'title' => $document->title,
            'file_name' => $document->file_name,
            'file_path' => $document->file_path,
            'mime_type' => $document->mime_type,
            'file_size' => $document->file_size,
            'issued_at' => $document->issued_at?->toDateString(),
            'expires_at' => $document->expires_at?->toDateString(),
            'is_expired' => $document->isExpired(),
            'days_until_expiry' => $document->daysUntilExpiry(),
            'reference' => $document->reference,
            'notes' => $document->notes,
        ];
    }
}
