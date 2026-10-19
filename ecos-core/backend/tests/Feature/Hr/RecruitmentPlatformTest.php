<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Modules\Hr\Compensation\Domain\Models\SalaryStructure;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Recruitment\Domain\Events\ApplicantHired;
use Modules\Hr\Recruitment\Domain\Events\ApplicationReceived;
use Modules\Hr\Recruitment\Domain\Events\InterviewScheduled;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicationStageEvent;
use Modules\Hr\Recruitment\Domain\Models\EmployeeLifecycleEvent;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;
use Modules\Hr\Recruitment\Domain\Services\ApplicantService;
use Modules\Hr\Recruitment\Domain\Services\EmployeeLifecycleService;
use Modules\Hr\Recruitment\Domain\Services\HiringService;
use Modules\Hr\Recruitment\Domain\Services\InterviewService;
use Modules\Hr\Recruitment\Domain\Services\JobApplicationService;
use Modules\Hr\Recruitment\Domain\Services\JobOpeningService;
use Modules\Hr\Recruitment\Domain\Services\RecruitmentPipelineService;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H5. Recruitment, Hiring & Employee Lifecycle.
 *
 * Protects what an ATS lives or dies by: applying creates an APPLICANT and never
 * an employee, the pipeline is configurable and every move is logged, duplicates
 * are surfaced rather than multiplied, hiring carries everything across without
 * re-entry, and the public portal exposes only what was published.
 */
class RecruitmentPlatformTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private const NOW = '2026-06-15 10:00:00';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));

        // The public portal is throttled per IP, and every test here shares one.
        // Behaviour is exercised without the limiter; that the limiter is
        // actually configured is asserted separately, against the route table.
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        $this->companyId = (string) Company::factory()->create()->id;
        $this->seedStages();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** The default pipeline the migration seeds — recreated for this test company. */
    private function seedStages(): void
    {
        $stages = [
            ['applied', 'Applied', 1, 'applied', true, false],
            ['initial_review', 'Initial Review', 2, 'screening', false, false],
            ['interview', 'Interview', 3, 'interview', false, false],
            ['accepted', 'Accepted', 4, 'decision', false, true],
        ];

        foreach ($stages as [$code, $name, $seq, $type, $initial, $terminal]) {
            RecruitmentStage::create([
                'company_id' => $this->companyId, 'code' => $code, 'name' => $name,
                'sequence' => $seq, 'type' => $type,
                'is_initial' => $initial, 'is_terminal' => $terminal, 'is_active' => true,
            ]);
        }
    }

    private function job(array $data = []): JobOpening
    {
        $job = app(JobOpeningService::class)->create($this->companyId, array_merge([
            'title' => 'Sales Representative',
            'openings_count' => 2,
            'salary_min' => 8000,
            'salary_max' => 12000,
        ], $data));

        return app(JobOpeningService::class)->publish($job);
    }

    private function applicant(string $name = 'Amir Hassan', string $mobile = '01001234567', ?string $email = 'amir@example.test'): Applicant
    {
        return app(ApplicantService::class)->create($this->companyId, [
            'full_name' => $name, 'mobile' => $mobile, 'email' => $email,
        ]);
    }

    private function apply(JobOpening $job, Applicant $applicant, array $data = []): JobApplication
    {
        return app(JobApplicationService::class)->submit($job, $applicant, array_merge([
            'years_experience' => 5, 'expected_salary' => 10000, 'available_from' => '2026-07-01',
        ], $data));
    }

    /**
     * Take a candidacy all the way to an accepted offer.
     *
     * Since Part 3, hiring requires one — a status alone no longer opens the door,
     * because only the offer records what salary and start date both sides saw.
     */
    private function acceptOffer(JobApplication $application, array $terms = []): \Modules\Hr\Recruitment\Domain\Models\Offer
    {
        if ($application->status !== ApplicationStatus::Accepted) {
            app(JobApplicationService::class)->decide($application, ApplicationStatus::Accepted);
        }

        $offers = app(\Modules\Hr\Recruitment\Domain\Services\OfferService::class);

        $offer = $offers->draft($application->refresh(), array_merge([
            'basic_salary' => 9000, 'start_date' => '2026-07-01',
        ], $terms));

        $offers->send($offer);

        return $offers->accept($offer->refresh());
    }

    // ═══ PUBLIC CAREERS PORTAL ═══════════════════════════════════════════════════

    public function test_the_public_jobs_board_shows_only_published_openings(): void
    {
        $published = $this->job(['title' => 'Published Role']);
        app(JobOpeningService::class)->create($this->companyId, ['title' => 'Draft Role']);

        $response = $this->getJson('/api/careers/jobs?company_id='.$this->companyId)->assertOk();
        $titles = array_column($response->json('data'), 'title');

        $this->assertContains('Published Role', $titles);
        $this->assertNotContains('Draft Role', $titles);
        $this->assertSame($published->slug, $response->json('data.0.slug'));
    }

    public function test_the_public_payload_hides_internal_fields(): void
    {
        $this->job();

        $card = $this->getJson('/api/careers/jobs?company_id='.$this->companyId)->json('data.0');

        // Whitelisted: no ids, no counts, no internal state reach a visitor.
        foreach (['id', 'company_id', 'status', 'filled_count', 'applications_count', 'hiring_manager_employee_id'] as $leaked) {
            $this->assertArrayNotHasKey($leaked, $card, "The public payload must not expose {$leaked}.");
        }
    }

    public function test_the_salary_band_appears_only_when_the_company_published_it(): void
    {
        $hidden = $this->job(['title' => 'Hidden Band', 'show_salary' => false]);
        $shown = $this->job(['title' => 'Shown Band', 'show_salary' => true]);

        $this->assertNull($this->getJson('/api/careers/jobs/'.$hidden->slug)->json('data.salary'));
        // Loose comparison: JSON renders 8000.00 as an integer.
        $this->assertEquals(8000, $this->getJson('/api/careers/jobs/'.$shown->slug)->json('data.salary.min'));
    }

    public function test_an_unpublished_job_is_indistinguishable_from_one_that_never_existed(): void
    {
        $draft = app(JobOpeningService::class)->create($this->companyId, ['title' => 'Secret Role']);

        $this->getJson('/api/careers/jobs/'.$draft->slug)->assertNotFound();
        $this->getJson('/api/careers/jobs/no-such-job')->assertNotFound();
    }

    public function test_applying_through_the_portal_creates_an_applicant_and_never_an_employee(): void
    {
        $job = $this->job();
        $employeesBefore = Employee::where('company_id', $this->companyId)->count();

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'Nour Ali',
            'mobile' => '01099887766',
            'email' => 'nour@example.test',
            'years_experience' => 3,
            'expected_salary' => 9000,
        ])->assertCreated()->assertJsonStructure(['data' => ['reference', 'job_title', 'submitted_at']]);

        $this->assertSame(1, Applicant::where('company_id', $this->companyId)->count());
        $this->assertSame(1, JobApplication::where('company_id', $this->companyId)->count());
        // The whole point: a form submission never puts a stranger in the workforce.
        $this->assertSame($employeesBefore, Employee::where('company_id', $this->companyId)->count());
    }

    public function test_the_portal_refuses_an_application_to_a_closed_job(): void
    {
        $job = $this->job();
        app(JobOpeningService::class)->close($job);

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'Late Applicant', 'mobile' => '01055556666',
        ])->assertStatus(422);
    }

    public function test_the_portal_validates_its_inputs(): void
    {
        $job = $this->job();

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'X',              // too short
            'mobile' => '123',               // too short
            'email' => 'not-an-email',
        ])->assertStatus(422)->assertJsonValidationErrors(['full_name', 'mobile', 'email']);
    }

    public function test_the_portal_rejects_an_upload_that_is_not_an_allowed_document(): void
    {
        Storage::fake('local');
        $job = $this->job();

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'Script Kiddie',
            'mobile' => '01044443333',
            'cv' => UploadedFile::fake()->create('payload.php', 20, 'application/x-php'),
        ])->assertStatus(422)->assertJsonValidationErrors(['cv']);
    }

    public function test_the_portal_stores_an_allowed_cv_on_a_private_disk(): void
    {
        Storage::fake('local');
        $job = $this->job();

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'Sara Kamal',
            'mobile' => '01033332222',
            'cv' => UploadedFile::fake()->create('sara-cv.pdf', 100, 'application/pdf'),
        ])->assertCreated();

        $applicant = Applicant::where('mobile', '01033332222')->firstOrFail();
        $attachment = $applicant->attachments()->where('type', 'cv')->firstOrFail();

        $this->assertTrue($attachment->is_public_upload);
        // A generated path — the uploader never chooses where it lands.
        $this->assertStringStartsWith('hr/applicants/'.$applicant->id, $attachment->file_path);
        $this->assertSame('sara-cv.pdf', $attachment->file_name);
    }

    public function test_reapplying_with_the_same_phone_and_email_reuses_the_person(): void
    {
        $first = $this->job(['title' => 'Role One']);
        $second = $this->job(['title' => 'Role Two']);
        $payload = ['full_name' => 'Repeat Applicant', 'mobile' => '01011112222', 'email' => 'repeat@example.test'];

        $this->postJson('/api/careers/jobs/'.$first->slug.'/apply', $payload)->assertCreated();
        $this->postJson('/api/careers/jobs/'.$second->slug.'/apply', $payload)->assertCreated();

        // One person, two candidacies.
        $this->assertSame(1, Applicant::where('company_id', $this->companyId)->count());
        $this->assertSame(2, JobApplication::where('company_id', $this->companyId)->count());
    }

    public function test_a_shared_phone_with_a_different_email_creates_a_separate_person(): void
    {
        $job = $this->job();

        $this->postJson('/api/careers/jobs/'.$job->slug.'/apply', [
            'full_name' => 'Sibling One', 'mobile' => '01088887777', 'email' => 'one@example.test',
        ])->assertCreated();

        $second = $this->job(['title' => 'Another Role']);
        $this->postJson('/api/careers/jobs/'.$second->slug.'/apply', [
            'full_name' => 'Sibling Two', 'mobile' => '01088887777', 'email' => 'two@example.test',
        ])->assertCreated();

        // A household phone is not proof of the same person — never auto-merged.
        $this->assertSame(2, Applicant::where('company_id', $this->companyId)->count());
    }

    // ═══ DUPLICATE DETECTION ═════════════════════════════════════════════════════

    public function test_duplicates_are_detected_by_phone_or_email_with_a_stated_confidence(): void
    {
        $this->applicant('Amir Hassan', '01001234567', 'amir@example.test');
        $service = app(ApplicantService::class);

        $both = $service->findDuplicates($this->companyId, '01001234567', 'amir@example.test');
        $this->assertSame('high', $both[0]['confidence']);
        $this->assertSame(['mobile', 'email'], $both[0]['matched_on']);

        $onlyPhone = $service->findDuplicates($this->companyId, '01001234567', 'someone.else@example.test');
        $this->assertSame('possible', $onlyPhone[0]['confidence']);

        $this->assertEmpty($service->findDuplicates($this->companyId, '01999999999', 'nobody@example.test'));
    }

    public function test_phone_numbers_match_regardless_of_formatting(): void
    {
        $this->applicant('Amir', '01001234567');

        $matches = app(ApplicantService::class)->findDuplicates($this->companyId, '+20 100 123 4567', null);

        // Digits only, international prefix stripped — the same human either way.
        $this->assertNotEmpty($matches);
    }

    public function test_merging_moves_the_applications_and_keeps_the_duplicate_as_a_tombstone(): void
    {
        $survivor = $this->applicant('Amir Hassan', '01001234567', 'amir@example.test');
        $duplicate = $this->applicant('A. Hassan', '01001234567', null);

        $job = $this->job();
        $this->apply($job, $duplicate);

        $merged = app(ApplicantService::class)->merge($duplicate, $survivor);

        $this->assertSame(1, $merged->applications()->count());
        $this->assertSame((string) $survivor->id, (string) $duplicate->fresh()->merged_into_id);
        $this->assertSame('merged', $duplicate->fresh()->status);
        // Nothing they submitted was deleted.
        $this->assertNotNull($duplicate->fresh());
    }

    public function test_an_applicant_cannot_be_merged_into_themselves(): void
    {
        $applicant = $this->applicant();

        $this->expectException(RecruitmentException::class);
        app(ApplicantService::class)->merge($applicant, $applicant);
    }

    // ═══ PIPELINE ════════════════════════════════════════════════════════════════

    public function test_an_application_lands_on_the_initial_stage_and_the_move_is_logged(): void
    {
        Event::fake([ApplicationReceived::class]);

        $application = $this->apply($this->job(), $this->applicant());

        $this->assertSame('Applied', $application->currentStage->name);
        $this->assertSame(ApplicationStatus::InPipeline, $application->status);

        $events = ApplicationStageEvent::where('application_id', $application->id)->get();
        $this->assertCount(1, $events);
        $this->assertSame('applied', $events[0]->action);

        Event::assertDispatched(ApplicationReceived::class);
    }

    public function test_advancing_follows_the_configured_sequence_and_logs_every_move(): void
    {
        $application = $this->apply($this->job(), $this->applicant());
        $service = app(JobApplicationService::class);

        $service->advance($application, 'CV looks good');
        $application = $service->advance($application->refresh(), 'Screening passed');

        $this->assertSame('Interview', $application->currentStage->name);
        $this->assertSame(3, ApplicationStageEvent::where('application_id', $application->id)->count());
    }

    public function test_the_pipeline_is_configurable_and_a_new_stage_is_honoured(): void
    {
        // Insert a stage between Applied and Initial Review, and move the latter
        // out of the way so the ordering is unambiguous.
        RecruitmentStage::where('company_id', $this->companyId)
            ->where('code', 'initial_review')->update(['sequence' => 5]);

        app(RecruitmentPipelineService::class)->create($this->companyId, [
            'code' => 'assessment', 'name' => 'Assessment', 'sequence' => 2, 'type' => 'screening',
        ]);

        $application = $this->apply($this->job(), $this->applicant());
        $advanced = app(JobApplicationService::class)->advance($application);

        // The new stage sits at sequence 2, so it is the next one — no code changed.
        $this->assertSame('Assessment', $advanced->currentStage->name);
    }

    public function test_the_board_counts_candidates_at_each_stage(): void
    {
        $job = $this->job();
        $this->apply($job, $this->applicant('One', '01000000001'));
        $second = $this->apply($job, $this->applicant('Two', '01000000002'));
        app(JobApplicationService::class)->advance($second);

        $board = app(JobApplicationService::class)->pipelineBoard($this->companyId, (string) $job->id);
        $byName = collect($board)->keyBy('name');

        $this->assertSame(1, $byName['Applied']['applications']);
        $this->assertSame(1, $byName['Initial Review']['applications']);
    }

    public function test_an_invalid_decision_transition_is_refused(): void
    {
        $application = $this->apply($this->job(), $this->applicant());
        $service = app(JobApplicationService::class);

        $rejected = $service->decide($application, ApplicationStatus::Rejected, 'Not a fit');

        // Rejected leads only to the talent pool — never straight back to accepted.
        $this->expectException(RecruitmentException::class);
        $service->decide($rejected, ApplicationStatus::Accepted);
    }

    public function test_the_same_person_cannot_apply_twice_to_one_opening(): void
    {
        $job = $this->job();
        $applicant = $this->applicant();
        $this->apply($job, $applicant);

        $this->expectException(RecruitmentException::class);
        $this->apply($job, $applicant);
    }

    // ═══ EVALUATION & INTERVIEWS ═════════════════════════════════════════════════

    public function test_an_evaluation_records_the_rating_reviewer_and_comments(): void
    {
        $application = $this->apply($this->job(), $this->applicant());
        $reviewer = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Rev', 'last_name' => 'Iewer']);

        $evaluation = app(InterviewService::class)->evaluate($application, [
            'rating' => 'very_good', 'comments' => 'Strong communicator',
        ], $reviewer);

        $this->assertSame('very_good', $evaluation->rating->value);
        $this->assertSame(80, $evaluation->effectiveScore());
        $this->assertSame((string) $reviewer->id, (string) $evaluation->reviewer_employee_id);
        $this->assertNotNull($evaluation->evaluated_at);
    }

    public function test_a_score_alone_derives_the_matching_rating(): void
    {
        $application = $this->apply($this->job(), $this->applicant());

        $evaluation = app(InterviewService::class)->evaluate($application, ['score' => 92]);

        $this->assertSame('excellent', $evaluation->rating->value);
        $this->assertSame(92, $evaluation->effectiveScore());
    }

    public function test_scheduling_an_interview_announces_it_for_a_calendar(): void
    {
        Event::fake([InterviewScheduled::class]);

        $application = $this->apply($this->job(), $this->applicant());
        $interviewer = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Man', 'last_name' => 'Ager']);

        $interview = app(InterviewService::class)->schedule($application, [
            'scheduled_at' => '2026-06-20 11:00:00',
            'mode' => 'video',
            'location' => 'https://meet.example/abc',
            'interviewer_employee_id' => (string) $interviewer->id,
        ]);

        $this->assertSame('scheduled', $interview->status->value);

        Event::assertDispatched(InterviewScheduled::class, function (InterviewScheduled $e) use ($interview) {
            return $e->interviewId === (string) $interview->id
                && $e->eventName() === 'hr.recruitment.interview_scheduled'
                && $e->mode === 'video';
        });
    }

    public function test_completing_an_interview_records_its_decision(): void
    {
        $application = $this->apply($this->job(), $this->applicant());
        $service = app(InterviewService::class);

        $interview = $service->schedule($application, ['scheduled_at' => '2026-06-18 09:00:00']);
        $completed = $service->complete($interview, ['decision' => 'proceed', 'notes' => 'Good fit']);

        $this->assertSame('completed', $completed->status->value);
        $this->assertSame('proceed', $completed->decision);
        $this->assertNotNull($completed->occurred_at);
    }

    // ═══ TALENT POOL ═════════════════════════════════════════════════════════════

    public function test_an_applicant_can_be_kept_in_the_talent_pool_for_a_future_opening(): void
    {
        $applicant = $this->applicant();

        $pooled = app(ApplicantService::class)->addToTalentPool(
            $applicant, 'Applied for Sales — suitable for Customer Service', ['customer_service']
        );

        $this->assertTrue($pooled->in_talent_pool);
        $this->assertSame(['customer_service'], $pooled->talent_pool_tags);
        $this->assertNotNull($pooled->talent_pool_added_at);

        $this->assertFalse(app(ApplicantService::class)->removeFromTalentPool($pooled)->in_talent_pool);
    }

    // ═══ HIRING ══════════════════════════════════════════════════════════════════

    public function test_hiring_creates_the_employee_contract_salary_manager_and_history_at_once(): void
    {
        Event::fake([ApplicantHired::class]);

        $department = Department::create(['company_id' => $this->companyId, 'code' => 'SLS', 'name' => 'Sales']);
        $manager = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Team', 'last_name' => 'Lead']);

        $job = $this->job(['department_id' => $department->id, 'hiring_manager_employee_id' => $manager->id]);
        $applicant = $this->applicant('Mona Saeed', '01077778888', 'mona@example.test');
        $application = $this->apply($job, $applicant);

        app(JobApplicationService::class)->decide($application, ApplicationStatus::Accepted, 'Strong candidate');
        $this->acceptOffer($application->refresh(), ['basic_salary' => 10000, 'start_date' => '2026-07-01']);

        $employee = app(HiringService::class)->hire($application->refresh(), [
            'hire_date' => '2026-07-01',
            'basic_salary' => 10000,
            'contract_type' => 'permanent',
        ]);

        // The employee — created through H1, so its numbering rules applied.
        $this->assertSame('Mona Saeed', $employee->fullName());
        $this->assertStringStartsWith('EMP-', (string) $employee->employee_number);
        $this->assertSame((string) $department->id, (string) $employee->department_id);
        $this->assertSame('probation', $employee->status->value);

        // The contract, active.
        $contract = $employee->activeContract();
        $this->assertNotNull($contract);
        $this->assertSame('permanent', $contract->type->value);

        // The salary — written by Payroll's own service.
        $salary = SalaryStructure::where('employee_id', $employee->id)->firstOrFail();
        $this->assertSame(10000.0, (float) $salary->basic_salary);

        // The reporting line.
        $this->assertSame(
            (string) $manager->id,
            (string) app(\Modules\Hr\Workforce\Domain\Services\ReportingLineService::class)
                ->currentManager($employee)?->id
        );

        // The first entry in their employment history, pointing back at the application.
        $hired = EmployeeLifecycleEvent::where('employee_id', $employee->id)->firstOrFail();
        $this->assertSame(LifecycleEventType::Hired, $hired->event_type);
        $this->assertSame('recruitment', $hired->source_module);
        $this->assertSame((string) $application->id, $hired->source_reference);

        // Both sides of the bridge are closed.
        $this->assertSame((string) $employee->id, (string) $applicant->fresh()->hired_employee_id);
        $this->assertSame('offer_accepted', $application->fresh()->status->value);
        $this->assertSame(1, (int) $job->fresh()->filled_count);

        Event::assertDispatched(ApplicantHired::class);
    }

    public function test_an_applicant_who_was_not_accepted_cannot_be_hired(): void
    {
        $application = $this->apply($this->job(), $this->applicant());

        $this->expectException(RecruitmentException::class);
        app(HiringService::class)->hire($application, ['basic_salary' => 9000]);
    }

    public function test_the_same_applicant_cannot_be_hired_twice(): void
    {
        $job = $this->job();
        $applicant = $this->applicant();
        $application = $this->apply($job, $applicant);
        $this->acceptOffer($application);
        app(HiringService::class)->hire($application->refresh(), ['basic_salary' => 9000]);

        $second = $this->apply($this->job(['title' => 'Other Role']), $applicant->fresh());
        $this->acceptOffer($second);

        $this->expectException(RecruitmentException::class);
        app(HiringService::class)->hire($second->refresh(), ['basic_salary' => 9000]);
    }

    public function test_the_hire_form_is_prefilled_from_what_is_already_known(): void
    {
        $department = Department::create(['company_id' => $this->companyId, 'code' => 'OPS', 'name' => 'Ops']);
        $job = $this->job(['department_id' => $department->id]);
        $application = $this->apply($job, $this->applicant(), ['expected_salary' => 11000]);
        $this->acceptOffer($application, ['basic_salary' => 10500]);

        $prefill = app(HiringService::class)->prefillFor($application->refresh());

        $this->assertSame((string) $department->id, (string) $prefill['department_id']);
        $this->assertSame(11000.0, $prefill['expected_salary']);
        $this->assertSame(8000.0, $prefill['salary_range']['min']);
        $this->assertTrue($prefill['can_hire']);

        // The agreed figure outranks both the advertised band and the candidate's
        // original ask, so nobody retypes what was already signed off.
        $this->assertSame(10500.0, $prefill['basic_salary']);
        $this->assertNotNull($prefill['offer']);
        $this->assertNull($prefill['blocked_by']);
    }

    public function test_an_accepted_candidacy_without_an_offer_cannot_be_hired(): void
    {
        $application = $this->apply($this->job(), $this->applicant());
        app(JobApplicationService::class)->decide($application, ApplicationStatus::Accepted);

        // The status says the company decided; no offer says nothing was agreed.
        $prefill = app(HiringService::class)->prefillFor($application->refresh());
        $this->assertFalse($prefill['can_hire']);
        $this->assertNotNull($prefill['blocked_by']);

        $this->expectException(RecruitmentException::class);
        app(HiringService::class)->hire($application->refresh(), ['basic_salary' => 9000]);
    }

    public function test_filling_every_position_closes_the_opening(): void
    {
        $job = $this->job(['openings_count' => 1]);
        $application = $this->apply($job, $this->applicant());
        $this->acceptOffer($application);

        app(HiringService::class)->hire($application->refresh(), ['basic_salary' => 9000]);

        $this->assertSame('filled', $job->fresh()->status->value);
        $this->assertSame(0, $job->fresh()->remainingPositions());
    }

    // ═══ EMPLOYEE LIFECYCLE ══════════════════════════════════════════════════════

    public function test_a_transfer_moves_the_employee_and_records_what_changed(): void
    {
        $from = Department::create(['company_id' => $this->companyId, 'code' => 'A', 'name' => 'Alpha']);
        $to = Department::create(['company_id' => $this->companyId, 'code' => 'B', 'name' => 'Beta']);

        $employee = app(EmployeeService::class)->create($this->companyId, [
            'first_name' => 'Mover', 'last_name' => 'One', 'department_id' => $from->id,
        ]);

        $moved = app(EmployeeLifecycleService::class)->transfer(
            $employee, ['department_id' => (string) $to->id], 'Restructure'
        );

        $this->assertSame((string) $to->id, (string) $moved->department_id);

        $event = EmployeeLifecycleEvent::where('employee_id', $employee->id)->latest('created_at')->firstOrFail();
        $this->assertSame(LifecycleEventType::Transferred, $event->event_type);
        $this->assertSame((string) $from->id, $event->from_values['department_id']);
        $this->assertSame((string) $to->id, $event->to_values['department_id']);
    }

    public function test_passing_probation_confirms_the_employee(): void
    {
        $employee = app(EmployeeService::class)->create($this->companyId, [
            'first_name' => 'New', 'last_name' => 'Joiner', 'status' => 'probation',
        ]);

        $confirmed = app(EmployeeLifecycleService::class)->passProbation($employee);

        $this->assertSame('active', $confirmed->status->value);
        $this->assertSame(
            LifecycleEventType::ProbationPassed,
            EmployeeLifecycleEvent::where('employee_id', $employee->id)->latest('created_at')->firstOrFail()->event_type
        );
    }

    public function test_a_separation_ends_employment_and_is_kept_in_the_history(): void
    {
        $employee = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Leaver', 'last_name' => 'One']);

        $separated = app(EmployeeLifecycleService::class)->separate($employee, 'Moving abroad', resigned: true);

        $this->assertSame('resigned', $separated->status->value);
        $this->assertNotNull($separated->termination_date);

        $event = EmployeeLifecycleEvent::where('employee_id', $employee->id)->latest('created_at')->firstOrFail();
        $this->assertSame(LifecycleEventType::Resigned, $event->event_type);
        $this->assertSame('Moving abroad', $event->reason);
    }

    public function test_lifecycle_history_is_append_only(): void
    {
        $employee = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Hist', 'last_name' => 'Ory']);
        app(EmployeeLifecycleService::class)->record($employee, LifecycleEventType::Hired, ['effective_date' => '2026-01-01']);

        $event = EmployeeLifecycleEvent::where('employee_id', $employee->id)->firstOrFail();
        $event->reason = 'rewritten';

        $this->assertFalse($event->save());
        $this->assertFalse($event->delete());
    }

    public function test_movements_are_summarised_for_turnover_reporting(): void
    {
        $lifecycle = app(EmployeeLifecycleService::class);
        $joiner = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Join', 'last_name' => 'Er']);
        $leaver = app(EmployeeService::class)->create($this->companyId, ['first_name' => 'Leave', 'last_name' => 'Er']);

        $lifecycle->record($joiner, LifecycleEventType::Hired, ['effective_date' => '2026-06-01']);
        $lifecycle->separate($leaver, 'Performance', effectiveDate: '2026-06-10');

        $movements = $lifecycle->movementsBetween($this->companyId, '2026-06-01', '2026-06-30');

        $this->assertSame(1, $movements['joiners']);
        $this->assertSame(1, $movements['leavers']);
        $this->assertSame(0, $movements['net_change']);
        $this->assertSame(1, $movements['terminations']);
    }

    // ═══ SECURITY ════════════════════════════════════════════════════════════════

    public function test_recruitment_management_routes_require_authentication(): void
    {
        $this->getJson('/api/hr/recruitment/jobs')->assertUnauthorized();
        $this->getJson('/api/hr/recruitment/applications')->assertUnauthorized();
        $this->getJson('/api/hr/lifecycle/movements')->assertUnauthorized();
    }
}
