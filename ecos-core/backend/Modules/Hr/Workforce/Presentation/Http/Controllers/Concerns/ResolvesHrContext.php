<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Shared company/actor resolution and scoped employee lookup for the HR controllers. */
trait ResolvesHrContext
{
    protected function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }

    protected function actorId(Request $request): ?int
    {
        $user = $request->user();

        return $user !== null ? (int) $user->id : null;
    }

    /** Always scoped to the caller's company — an id from another tenant 404s. */
    protected function employee(Request $request, string $id): Employee
    {
        return Employee::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }

    /** The employee record behind the signed-in user, when there is one. */
    protected function actingEmployee(Request $request): ?Employee
    {
        $userId = $this->actorId($request);

        if ($userId === null) {
            return null;
        }

        return Employee::query()
            ->where('company_id', $this->companyId($request))
            ->where('user_id', $userId)
            ->first();
    }
}
