<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Attendance\Domain\Models\OfficialHoliday;
use Modules\Hr\Attendance\Domain\Models\Shift;
use Modules\Hr\Attendance\Domain\Models\WorkCalendar;
use Modules\Hr\Attendance\Domain\Services\HolidayService;
use Modules\Hr\Attendance\Domain\Services\WorkScheduleService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Work calendars, shifts and official holidays. */
class WorkScheduleController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly WorkScheduleService $schedule,
        private readonly HolidayService $holidays,
    ) {}

    // ── Calendars ─────────────────────────────────────────────────────────────

    public function calendars(Request $request): JsonResponse
    {
        return response()->json([
            'data' => WorkCalendar::query()->where('company_id', $this->companyId($request))->orderBy('name')->get(),
        ]);
    }

    public function storeCalendar(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:120'],
            'working_days' => ['required', 'array', 'min:1'],
            'working_days.*' => ['integer', 'min:1', 'max:7'],
            'default_start_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'default_end_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->schedule->createCalendar($this->companyId($request), $v)], 201);
    }

    public function updateCalendar(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'code' => ['sometimes', 'string', 'max:30'],
            'name' => ['sometimes', 'string', 'max:120'],
            'working_days' => ['sometimes', 'array', 'min:1'],
            'working_days.*' => ['integer', 'min:1', 'max:7'],
            'default_start_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'default_end_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $calendar = $this->scoped(WorkCalendar::class, $request, $id);

        return response()->json(['data' => $this->schedule->updateCalendar($calendar, $v)]);
    }

    // ── Shifts ────────────────────────────────────────────────────────────────

    public function shifts(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Shift::query()->where('company_id', $this->companyId($request))->orderBy('start_time')->get(),
        ]);
    }

    public function storeShift(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:120'],
            'start_time' => ['required', 'date_format:H:i,H:i:s'],
            'end_time' => ['required', 'date_format:H:i,H:i:s'],
            'work_calendar_id' => ['nullable', 'string'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:600'],
            'crosses_midnight' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->schedule->createShift($this->companyId($request), $v)], 201);
    }

    public function updateShift(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'code' => ['sometimes', 'string', 'max:30'],
            'name' => ['sometimes', 'string', 'max:120'],
            'start_time' => ['sometimes', 'date_format:H:i,H:i:s'],
            'end_time' => ['sometimes', 'date_format:H:i,H:i:s'],
            'work_calendar_id' => ['nullable', 'string'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:600'],
            'crosses_midnight' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->schedule->updateShift($this->scoped(Shift::class, $request, $id), $v)]);
    }

    public function assignShift(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'shift_id' => ['required', 'string'],
            'effective_from' => ['nullable', 'date'],
        ]);

        $assignment = $this->schedule->assignShift(
            $this->employee($request, $employeeId),
            $this->scoped(Shift::class, $request, $v['shift_id']),
            $v['effective_from'] ?? null,
        );

        return response()->json(['data' => $assignment], 201);
    }

    // ── Holidays ──────────────────────────────────────────────────────────────

    public function holidays(Request $request): JsonResponse
    {
        $rows = OfficialHoliday::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('start_date')->get()
            ->map(fn (OfficialHoliday $h) => [
                'id' => $h->id,
                'name' => $h->name,
                'start_date' => $h->start_date?->toDateString(),
                'end_date' => $h->end_date?->toDateString(),
                'days' => $h->days(),
                'type' => $h->type->value,
                'type_label' => $h->type->label(),
                'moves_annually' => $h->type->movesAnnually(),
                'notes' => $h->notes,
                'is_active' => $h->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function storeHoliday(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date'],
            'type' => ['nullable', 'in:public,religious,national,company'],
            'notes' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->holidays->create($this->companyId($request), $v)], 201);
    }

    public function updateHoliday(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['nullable', 'date'],
            'type' => ['nullable', 'in:public,religious,national,company'],
            'notes' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->holidays->update($this->scoped(OfficialHoliday::class, $request, $id), $v)]);
    }

    public function destroyHoliday(Request $request, string $id): JsonResponse
    {
        $this->holidays->delete($this->scoped(OfficialHoliday::class, $request, $id));

        return response()->json(['data' => ['deleted' => true]]);
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  class-string<TModel>  $model
     * @return TModel
     */
    private function scoped(string $model, Request $request, string $id)
    {
        return $model::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }
}
