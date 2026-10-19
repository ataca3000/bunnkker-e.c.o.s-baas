<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicantAttachment;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;
use Modules\Hr\Recruitment\Domain\Services\ApplicantService;
use Modules\Hr\Recruitment\Domain\Services\JobApplicationService;
use Modules\Hr\Recruitment\Domain\Services\JobOpeningService;

/**
 * The public careers portal.
 *
 * ┌─ THE ONLY UNAUTHENTICATED SURFACE IN THE SYSTEM ────────────────────────┐
 * │ Everything here is reachable by anyone on the internet, so it is written    │
 * │ defensively rather than conveniently:                                      │
 * │                                                                            │
 * │   · READS are whitelisted field by field. Nothing reaches a visitor because │
 * │     it happens to sit on the row — the salary band appears only when        │
 * │     `show_salary` is set, and internal ids, counts and notes never appear.  │
 * │   · Only PUBLISHED, public, in-date openings are queryable, enforced by one │
 * │     scope so no endpoint can forget a condition.                           │
 * │   · WRITES create an applicant and an application and NOTHING else. No      │
 * │     employee, no user, no salary record.                                    │
 * │   · Uploads are restricted by extension, mime and size, stored on a private │
 * │     disk under a generated name, and never served back from here.           │
 * │   · Duplicate applicants are reused rather than multiplied, but two people  │
 * │     are never merged automatically — a shared household phone is real.      │
 * │                                                                            │
 * │ Throttling is applied at the route, not here, so it cannot be bypassed by   │
 * │ calling the controller another way.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class PublicCareersController extends Controller
{
    /** What a CV or certificate may be. Anything else is refused outright. */
    private const ALLOWED_MIME = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
    ];

    private const MAX_UPLOAD_KB = 5120;   // 5 MB

    public function __construct(
        private readonly JobOpeningService $openings,
        private readonly ApplicantService $applicants,
        private readonly JobApplicationService $applications,
    ) {}

    /** The jobs board. */
    public function jobs(Request $request): JsonResponse
    {
        $v = $request->validate([
            'company_id' => ['nullable', 'string'],
            'department_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'work_mode' => ['nullable', 'in:onsite,hybrid,remote'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $jobs = $this->openings->publiclyVisible($v['company_id'] ?? null, $v);

        return response()->json(['data' => $jobs->map(fn (JobOpening $job) => $this->publicSummary($job))->all()]);
    }

    /** One job, by its stable public slug. */
    public function job(string $slug): JsonResponse
    {
        $job = JobOpening::query()
            ->with(['department:id,name', 'employmentType:id,name'])
            ->publiclyVisible()
            ->where('slug', $slug)
            ->first();

        if ($job === null) {
            // Deliberately indistinguishable from "never existed" — whether a draft
            // job exists is not something a visitor should be able to probe.
            return response()->json(['message' => 'This job is not available.'], 404);
        }

        return response()->json(['data' => $this->publicDetail($job)]);
    }

    /**
     * Submit an application.
     *
     * Creates an applicant (or reuses the existing one) and an application. It
     * cannot create an employee — that is a separate, permissioned act.
     */
    public function apply(Request $request, string $slug): JsonResponse
    {
        $job = JobOpening::query()->publiclyVisible()->where('slug', $slug)->first();

        if ($job === null || ! $job->isOpenForApplications()) {
            return response()->json(['message' => 'This job is no longer accepting applications.'], 422);
        }

        $v = $request->validate([
            // Personal
            'full_name' => ['required', 'string', 'min:2', 'max:200'],
            'mobile' => ['required', 'string', 'min:6', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],

            // Professional
            'years_experience' => ['nullable', 'numeric', 'min:0', 'max:70'],
            'current_employer' => ['nullable', 'string', 'max:200'],
            'previous_employer' => ['nullable', 'string', 'max:200'],
            'expected_salary' => ['nullable', 'numeric', 'min:0'],
            'available_from' => ['nullable', 'date'],
            'additional_notes' => ['nullable', 'string', 'max:2000'],

            // Attachments
            'cv' => ['nullable', 'file', 'max:'.self::MAX_UPLOAD_KB, 'mimes:pdf,doc,docx'],
            'photo' => ['nullable', 'file', 'max:'.self::MAX_UPLOAD_KB, 'mimes:jpg,jpeg,png'],
            'certificates' => ['nullable', 'array', 'max:5'],
            'certificates.*' => ['file', 'max:'.self::MAX_UPLOAD_KB, 'mimes:pdf,jpg,jpeg,png'],
        ]);

        try {
            $result = DB::transaction(function () use ($job, $v, $request) {
                $applicant = $this->resolveApplicant((string) $job->company_id, $v);

                $application = $this->applications->submit($job, $applicant, [
                    'years_experience' => $v['years_experience'] ?? null,
                    'current_employer' => $v['current_employer'] ?? null,
                    'previous_employer' => $v['previous_employer'] ?? null,
                    'expected_salary' => $v['expected_salary'] ?? null,
                    'currency' => $job->currency,
                    'available_from' => $v['available_from'] ?? null,
                    'additional_notes' => $v['additional_notes'] ?? null,
                    'source' => 'careers_portal',
                ]);

                $this->storeUploads($request, $applicant, (string) $application->id);

                return ['applicant' => $applicant, 'application' => $application];
            });
        } catch (RecruitmentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // The receipt tells the applicant what they need and nothing more — no
        // internal ids, no pipeline state, no indication of how many others applied.
        return response()->json([
            'data' => [
                'reference' => $result['application']->application_number,
                'job_title' => $job->title,
                'submitted_at' => $result['application']->applied_at?->toDateTimeString(),
                'message' => 'Thank you — your application has been received.',
            ],
        ], 201);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Reuse the applicant when this is plainly the same person applying again;
     * otherwise create one. Never merges two records automatically.
     */
    private function resolveApplicant(string $companyId, array $data): Applicant
    {
        $matches = $this->applicants->findDuplicates(
            $companyId, $data['mobile'] ?? null, $data['email'] ?? null
        );

        // Only a high-confidence match — both mobile AND email — is reused without
        // a human looking. A shared phone number is not the same person.
        $confident = array_values(array_filter($matches, fn (array $m) => $m['confidence'] === 'high'));

        if ($confident !== []) {
            $existing = Applicant::query()
                ->where('company_id', $companyId)
                ->where('id', $confident[0]['id'])
                ->first();

            if ($existing !== null && ! $existing->isMerged()) {
                return $existing;
            }
        }

        return $this->applicants->create($companyId, $data + ['source' => 'careers_portal']);
    }

    private function storeUploads(Request $request, Applicant $applicant, string $applicationId): void
    {
        $files = [];

        if ($request->hasFile('cv')) {
            $files[] = ['type' => 'cv', 'file' => $request->file('cv'), 'title' => 'CV / Resume'];
        }

        if ($request->hasFile('photo')) {
            $files[] = ['type' => 'photo', 'file' => $request->file('photo'), 'title' => 'Personal Photo'];
        }

        foreach ((array) $request->file('certificates', []) as $index => $certificate) {
            $files[] = ['type' => 'certificate', 'file' => $certificate, 'title' => 'Certificate '.($index + 1)];
        }

        foreach ($files as $entry) {
            $file = $entry['file'];

            if (! $file instanceof UploadedFile || ! $file->isValid()) {
                continue;
            }

            // Belt and braces: the validator checked the extension, this checks
            // what the file actually claims to be.
            if (! in_array((string) $file->getMimeType(), self::ALLOWED_MIME, true)) {
                continue;
            }

            // A generated name on a private disk — the uploader never chooses the
            // path, and nothing here serves the file back.
            $path = $file->store('hr/applicants/'.$applicant->id, 'local');

            ApplicantAttachment::create([
                'company_id' => $applicant->company_id,
                'applicant_id' => $applicant->id,
                'application_id' => $applicationId,
                'type' => $entry['type'],
                'title' => $entry['title'],
                'file_path' => (string) $path,
                'file_name' => (string) $file->getClientOriginalName(),
                'mime_type' => (string) $file->getMimeType(),
                'file_size' => (int) $file->getSize(),
                'is_public_upload' => true,
            ]);
        }

        unset($files);
        Storage::disk('local');   // ensure the disk is resolved even with no uploads
    }

    /**
     * The jobs-board card. Every field is listed explicitly.
     *
     * @return array<string, mixed>
     */
    private function publicSummary(JobOpening $job): array
    {
        return [
            'slug' => $job->slug,
            'title' => $job->title,
            'department' => $job->department?->name,
            'employment_type' => $job->employmentType?->name,
            'work_location' => $job->work_location,
            'work_mode' => $job->work_mode,
            'openings' => (int) $job->openings_count,
            'published_at' => $job->published_at?->toDateString(),
            'closes_on' => $job->closes_on?->toDateString(),
        ] + $this->publicSalary($job);
    }

    /**
     * The job page. Still a whitelist — the longer text, and nothing structural.
     *
     * @return array<string, mixed>
     */
    private function publicDetail(JobOpening $job): array
    {
        return $this->publicSummary($job) + [
            'description' => $job->description,
            'requirements' => $job->requirements,
            'responsibilities' => $job->responsibilities,
            'accepting_applications' => $job->isOpenForApplications(),
        ];
    }

    /**
     * The salary band, only when the company chose to publish it.
     *
     * @return array<string, mixed>
     */
    private function publicSalary(JobOpening $job): array
    {
        if (! $job->show_salary) {
            return ['salary' => null];
        }

        return [
            'salary' => [
                'min' => $job->salary_min === null ? null : (float) $job->salary_min,
                'max' => $job->salary_max === null ? null : (float) $job->salary_max,
                'currency' => $job->currency,
            ],
        ];
    }
}
