<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\Offer;
use Modules\Hr\Recruitment\Domain\Services\OfferService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Offer letters — drafting, revising, sending, and the candidate's answer. */
class OfferController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly OfferService $offers) {}

    public function index(Request $request): JsonResponse
    {
        $query = Offer::query()
            ->with(['applicant:id,full_name', 'versions'])
            ->where('company_id', $this->companyId($request))
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('application_id')) {
            $query->where('application_id', (string) $request->query('application_id'));
        }

        return response()->json([
            'data' => $query->limit(200)->get()->map(fn (Offer $offer) => [
                'id' => (string) $offer->id,
                'offer_number' => $offer->offer_number,
                'candidate_name' => $offer->applicant->full_name ?? null,
                'application_id' => (string) $offer->application_id,
                'status' => $offer->status->value,
                'status_label' => $offer->status->label(),
                'current_version' => (int) $offer->current_version,
                'basic_salary' => (float) ($offer->currentTerms()->basic_salary ?? 0),
                'currency' => $offer->currentTerms()->currency ?? 'EGP',
                'start_date' => $offer->currentTerms()?->start_date?->toDateString(),
                'expires_on' => $offer->expires_on?->toDateString(),
                'has_lapsed' => $offer->hasLapsed(),
                'sent_at' => $offer->sent_at?->toDateTimeString(),
                'responded_at' => $offer->responded_at?->toDateTimeString(),
            ])->all(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->offers->detail($this->offer($request, $id))]);
    }

    /** The letter, as content. Rendered to a print-ready page by the client. */
    public function document(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->offers->document($this->offer($request, $id))]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        $v = $request->validate([
            'basic_salary' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'start_date' => ['nullable', 'date'],
            'expires_on' => ['nullable', 'date'],
            'position_id' => ['nullable', 'string'],
            'department_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'candidate_name' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $application = JobApplication::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($applicationId);

        $offer = $this->offers->draft($application, $v, $this->actorId($request));

        return response()->json(['data' => $this->offers->detail($offer)], 201);
    }

    public function revise(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'reason' => ['required', 'string', 'max:400'],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'start_date' => ['nullable', 'date'],
            'position_id' => ['nullable', 'string'],
            'department_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $offer = $this->offers->revise(
            $this->offer($request, $id),
            $v,
            (string) $v['reason'],
            $this->actorId($request),
        );

        return response()->json(['data' => $this->offers->detail($offer)]);
    }

    public function send(Request $request, string $id): JsonResponse
    {
        $offer = $this->offers->send($this->offer($request, $id), $this->actorId($request));

        return response()->json(['data' => $this->offers->detail($offer)]);
    }

    public function accept(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $offer = $this->offers->accept($this->offer($request, $id), $v['note'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->offers->detail($offer)]);
    }

    public function decline(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $offer = $this->offers->decline($this->offer($request, $id), $v['note'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->offers->detail($offer)]);
    }

    public function withdraw(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $offer = $this->offers->withdraw($this->offer($request, $id), (string) $v['reason'], $this->actorId($request));

        return response()->json(['data' => $this->offers->detail($offer)]);
    }

    /** Sweep everything past its date. Idempotent. */
    public function expireLapsed(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->offers->expireLapsed($this->companyId($request))]);
    }

    private function offer(Request $request, string $id): Offer
    {
        return Offer::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }
}
