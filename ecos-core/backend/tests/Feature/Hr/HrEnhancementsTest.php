<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentComponent;
use Modules\Hr\Compensation\Domain\Enums\BonusType;
use Modules\Hr\Compensation\Domain\Enums\CommissionMethod;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Enums\PayrollRunStatus;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\PayrollRun;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\CommissionPreviewService;
use Modules\Hr\Compensation\Domain\Services\CommissionRuleService;
use Modules\Hr\Compensation\Domain\Services\CompensationAdjustmentService;
use Modules\Hr\Compensation\Domain\Services\CompensationLockService;
use Modules\Hr\Compensation\Domain\Services\DeductionService;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Compensation\Domain\Services\PayrollRunService;
use Modules\Hr\Compensation\Domain\Services\PayslipExplainerService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Enums\ExitType;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Recruitment\Domain\Enums\OfferStatus;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTag;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTimelineEvent;
use Modules\Hr\Recruitment\Domain\Models\ExitChecklistItem;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;
use Modules\Hr\Recruitment\Domain\Models\Offer;
use Modules\Hr\Recruitment\Domain\Models\OfferVersion;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;
use Modules\Hr\Recruitment\Domain\Services\ApplicantService;
use Modules\Hr\Recruitment\Domain\Services\ApplicantTagService;
use Modules\Hr\Recruitment\Domain\Services\ApplicantTimelineService;
use Modules\Hr\Recruitment\Domain\Services\BulkRecruitmentService;
use Modules\Hr\Recruitment\Domain\Services\ExitProcessService;
use Modules\Hr\Recruitment\Domain\Services\JobApplicationService;
use Modules\Hr\Recruitment\Domain\Services\JobOpeningService;
use Modules\Hr\Recruitment\Domain\Services\OfferService;
use Modules\Hr\Recruitment\Domain\Services\RecruitmentAnalyticsService;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-HR-V1-ENHANCEMENTS-001 — all eight parts.
 *
 * What these tests actually protect: that a tag is a catalogue entry rather than
 * a typed word, that a timeline can be appended to and never rewritten, that
 * hiring cannot happen without an accepted offer, that an exit cannot complete
 * over an outstanding mandatory item, that approved pay refuses to be edited,
 * and that changing a commission rate cannot reach backwards into payroll that
 * has already been announced.
 */
class HrEnhancementsTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private const NOW = '2026-06-15 10:00:00';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));

        $this->companyId = (string) Company::factory()->create()->id;
        $this->seedStages();
        $this->seedTags();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ═══ PART 1 — APPLICANT TAGS ═════════════════════════════════════════════

    public function test_tags_are_a_company_catalogue_rather_than_typed_words(): void
    {
        $catalogue = app(ApplicantTagService::class)->catalogue($this->companyId);

        $this->assertGreaterThanOrEqual(3, count($catalogue));
        $this->assertContains('vip', array_column($catalogue, 'key'));

        // Colour belongs to the tag, not to whichever screen is drawing it.
        $vip = collect($catalogue)->firstWhere('key', 'vip');
        $this->assertNotNull($vip['color']);
    }

    public function test_an_applicant_can_carry_several_tags_and_adding_one_twice_changes_nothing(): void
    {
        $applicant = $this->applicant();
        $tags = app(ApplicantTagService::class);

        $tags->assign($applicant, $this->tag('vip'));
        $tags->assign($applicant, $this->tag('urgent'));
        $tags->assign($applicant, $this->tag('vip'));   // again

        $carried = $tags->tagsFor((string) $applicant->id);

        $this->assertCount(2, $carried);
        $this->assertEqualsCanonicalizing(['vip', 'urgent'], array_column($carried, 'key'));
    }

    public function test_tags_can_be_searched_by_any_and_by_all(): void
    {
        $tags = app(ApplicantTagService::class);

        $both = $this->applicant('Both Tags', '01011111111', 'both@example.test');
        $one = $this->applicant('One Tag', '01022222222', 'one@example.test');

        $tags->assign($both, $this->tag('vip'));
        $tags->assign($both, $this->tag('urgent'));
        $tags->assign($one, $this->tag('vip'));

        $any = $tags->applicantIdsWithTags($this->companyId, ['vip', 'urgent'], matchAll: false);
        $all = $tags->applicantIdsWithTags($this->companyId, ['vip', 'urgent'], matchAll: true);

        $this->assertCount(2, $any);
        $this->assertCount(1, $all);
        $this->assertSame((string) $both->id, (string) $all[0]);
    }

    public function test_adding_and_removing_a_tag_both_leave_an_audit_trail(): void
    {
        $applicant = $this->applicant();
        $tags = app(ApplicantTagService::class);

        $tags->assign($applicant, $this->tag('vip'), 'Handled by the MD', 7);
        $tags->remove($applicant, $this->tag('vip'), 9);

        $events = ApplicantTimelineEvent::where('applicant_id', $applicant->id)
            ->whereIn('event_type', [TimelineEventType::TagAdded->value, TimelineEventType::TagRemoved->value])
            ->orderBy('occurred_at')->get();

        $this->assertCount(2, $events);
        // The assignment row is gone; who removed it is not.
        $this->assertSame(7, $events[0]->actor_id);
        $this->assertSame(9, $events[1]->actor_id);
        $this->assertSame('vip', $events[1]->context['tag_key']);
    }

    public function test_a_tag_in_use_is_deactivated_rather_than_deleted(): void
    {
        $applicant = $this->applicant();
        $tag = $this->tag('vip');
        app(ApplicantTagService::class)->assign($applicant, $tag);

        $this->expectException(RecruitmentException::class);
        app(ApplicantTagService::class)->deleteTag($tag);
    }

    public function test_a_tag_from_another_company_cannot_be_assigned(): void
    {
        $otherCompany = (string) Company::factory()->create()->id;
        $foreign = ApplicantTag::create([
            'company_id' => $otherCompany, 'key' => 'foreign', 'name' => 'Foreign', 'color' => 'slate',
        ]);

        $this->expectException(RecruitmentException::class);
        app(ApplicantTagService::class)->assign($this->applicant(), $foreign);
    }

    // ═══ PART 4 — APPLICANT TIMELINE ═════════════════════════════════════════

    public function test_the_timeline_is_append_only(): void
    {
        $applicant = $this->applicant();

        $event = app(ApplicantTimelineService::class)->record(
            $this->companyId, (string) $applicant->id, TimelineEventType::NoteAdded, ['title' => 'A note']
        );

        $this->assertFalse($event->update(['title' => 'Rewritten']));
        $this->assertFalse($event->delete());
        $this->assertSame('A note', $event->fresh()->title);
    }

    public function test_the_timeline_is_chronological_and_filterable(): void
    {
        $applicant = $this->applicant();
        $timeline = app(ApplicantTimelineService::class);

        $timeline->record($this->companyId, (string) $applicant->id, TimelineEventType::NoteAdded, [
            'title' => 'Second', 'occurred_at' => Carbon::parse('2026-06-10 12:00:00'),
        ]);
        $timeline->record($this->companyId, (string) $applicant->id, TimelineEventType::TagAdded, [
            'title' => 'First', 'occurred_at' => Carbon::parse('2026-06-01 12:00:00'),
        ]);

        $all = $timeline->forApplicant($this->companyId, (string) $applicant->id);
        $this->assertSame('First', $all[0]['title']);
        $this->assertSame('Second', $all[1]['title']);

        $tagsOnly = $timeline->forApplicant($this->companyId, (string) $applicant->id, ['category' => 'tag']);
        $this->assertCount(1, $tagsOnly);
        $this->assertSame('First', $tagsOnly[0]['title']);
    }

    public function test_the_timeline_separates_milestones_from_activity(): void
    {
        $applicant = $this->applicant();
        $application = $this->apply($this->job(), $applicant);

        $timeline = app(ApplicantTimelineService::class);
        $timeline->recordForApplication($application, TimelineEventType::ApplicationSubmitted, ['title' => 'Applied']);
        $timeline->recordForApplication($application, TimelineEventType::TagAdded, ['title' => 'Tagged']);

        $milestones = $timeline->forApplicant($this->companyId, (string) $applicant->id, ['milestones_only' => true]);

        $this->assertCount(1, $milestones);
        $this->assertSame('Applied', $milestones[0]['title']);
    }

    public function test_a_timeline_entry_with_no_actor_is_marked_as_system(): void
    {
        $applicant = $this->applicant();

        $withActor = app(ApplicantTimelineService::class)->record(
            $this->companyId, (string) $applicant->id, TimelineEventType::NoteAdded, ['title' => 'By a person'], 42
        );
        $withoutActor = app(ApplicantTimelineService::class)->record(
            $this->companyId, (string) $applicant->id, TimelineEventType::OfferExpired, ['title' => 'By the calendar']
        );

        $this->assertFalse($withActor->is_system);
        $this->assertTrue($withoutActor->is_system);
    }

    // ═══ PART 3 — OFFER MANAGEMENT ═══════════════════════════════════════════

    public function test_an_offer_records_its_terms_and_its_number(): void
    {
        $application = $this->acceptedApplication();

        $offer = app(OfferService::class)->draft($application, [
            'basic_salary' => 12000, 'currency' => 'EGP', 'start_date' => '2026-07-01', 'expires_on' => '2026-06-25',
        ]);

        $this->assertStringStartsWith('OFF-', (string) $offer->offer_number);
        $this->assertSame(OfferStatus::Draft, $offer->status);
        $this->assertSame(12000.0, (float) $offer->currentTerms()->basic_salary);
        $this->assertSame('2026-07-01', $offer->currentTerms()->start_date->toDateString());
    }

    public function test_revising_an_offer_appends_a_version_and_leaves_the_previous_one_intact(): void
    {
        $offer = $this->draftOffer(['basic_salary' => 12000]);

        app(OfferService::class)->revise($offer, ['basic_salary' => 13500], 'Candidate countered');

        $detail = app(OfferService::class)->detail($offer->refresh());

        $this->assertSame(2, $detail['current_version']);
        $this->assertCount(2, $detail['version_history']);
        // The first number survives — the whole reason versions exist.
        $this->assertSame(12000.0, $detail['version_history'][0]['terms']['basic_salary']);
        $this->assertSame(13500.0, $detail['version_history'][1]['terms']['basic_salary']);
        $this->assertSame(
            ['from' => 12000.0, 'to' => 13500.0],
            $detail['version_history'][1]['changes']['basic_salary']
        );
    }

    public function test_an_offer_version_cannot_be_rewritten(): void
    {
        $offer = $this->draftOffer();
        $version = $offer->currentTerms();

        $this->assertFalse($version->update(['basic_salary' => 1]));
        $this->assertFalse($version->delete());
    }

    public function test_the_offer_workflow_runs_draft_sent_accepted(): void
    {
        $offers = app(OfferService::class);
        $offer = $this->draftOffer();

        $offers->send($offer);
        $this->assertSame(OfferStatus::Sent, $offer->refresh()->status);
        $this->assertSame(ApplicationStatus::OfferSent, $offer->application->refresh()->status);

        $offers->accept($offer->refresh(), 'Delighted');
        $this->assertSame(OfferStatus::Accepted, $offer->refresh()->status);
        $this->assertSame(ApplicationStatus::OfferAccepted, $offer->application->refresh()->status);
        $this->assertTrue($offer->refresh()->permitsHiring());
    }

    public function test_a_declined_offer_cannot_then_be_accepted(): void
    {
        $offers = app(OfferService::class);
        $offer = $this->draftOffer();
        $offers->send($offer);
        $offers->decline($offer->refresh(), 'Took another role');

        $this->expectException(RecruitmentException::class);
        $offers->accept($offer->refresh());
    }

    public function test_an_offer_past_its_expiry_cannot_be_accepted_late(): void
    {
        $offers = app(OfferService::class);
        $offer = $this->draftOffer(['expires_on' => '2026-06-20']);
        $offers->send($offer);

        Carbon::setTestNow(Carbon::parse('2026-06-25 09:00:00'));

        try {
            $offers->accept($offer->refresh());
            $this->fail('An expired offer was accepted.');
        } catch (RecruitmentException) {
            // The date was the company's commitment, and it ran out.
            $this->assertSame(OfferStatus::Expired, $offer->refresh()->status);
        }
    }

    public function test_the_expiry_sweep_is_idempotent(): void
    {
        $offers = app(OfferService::class);
        $offer = $this->draftOffer(['expires_on' => '2026-06-20']);
        $offers->send($offer);

        Carbon::setTestNow(Carbon::parse('2026-06-25 09:00:00'));

        $first = $offers->expireLapsed($this->companyId);
        $second = $offers->expireLapsed($this->companyId);

        $this->assertSame(1, $first['expired']);
        $this->assertSame(0, $second['expired']);
    }

    public function test_a_second_offer_cannot_be_drafted_while_one_is_still_open(): void
    {
        $application = $this->acceptedApplication();
        app(OfferService::class)->draft($application, ['basic_salary' => 12000]);

        $this->expectException(RecruitmentException::class);
        app(OfferService::class)->draft($application->refresh(), ['basic_salary' => 13000]);
    }

    public function test_the_offer_version_freezes_the_department_name_it_was_written_with(): void
    {
        $department = Department::create(['company_id' => $this->companyId, 'code' => 'SLS', 'name' => 'Sales']);
        $application = $this->acceptedApplication(['department_id' => $department->id]);

        $offer = app(OfferService::class)->draft($application, ['basic_salary' => 12000]);
        $this->assertSame('Sales', $offer->currentTerms()->department_name);

        // Renaming the department does not rewrite what the candidate was told.
        $department->update(['name' => 'Commercial']);
        $this->assertSame('Sales', $offer->refresh()->currentTerms()->department_name);
    }

    public function test_every_offer_event_lands_on_the_timeline(): void
    {
        $offers = app(OfferService::class);
        $offer = $this->draftOffer();
        $offers->revise($offer, ['basic_salary' => 13000], 'Counter');
        $offers->send($offer->refresh());
        $offers->accept($offer->refresh());

        $types = ApplicantTimelineEvent::where('applicant_id', $offer->applicant_id)
            ->orderBy('occurred_at')->pluck('event_type')->map(fn ($t) => $t instanceof TimelineEventType ? $t->value : $t)->all();

        foreach (['offer_generated', 'offer_revised', 'offer_sent', 'offer_accepted'] as $expected) {
            $this->assertContains($expected, $types);
        }
    }

    // ═══ PART 2 — BULK ACTIONS ═══════════════════════════════════════════════

    public function test_a_bulk_action_reports_each_failure_rather_than_rolling_everything_back(): void
    {
        $job = $this->job();
        $good = $this->apply($job, $this->applicant('Good One', '01033333333', 'good@example.test'));
        $alreadyClosed = $this->apply($job, $this->applicant('Closed One', '01044444444', 'closed@example.test'));

        app(JobApplicationService::class)->decide($alreadyClosed, ApplicationStatus::Rejected, 'No');

        $result = app(BulkRecruitmentService::class)->execute(
            $this->companyId,
            'reject',
            [(string) $good->id, (string) $alreadyClosed->id, 'not-a-real-id'],
            ['reason' => 'Role cancelled'],
        );

        $this->assertSame(3, $result['requested']);
        $this->assertSame(1, $result['succeeded']);
        $this->assertSame(2, $result['failed']);
        // Each failure names itself and says why.
        $this->assertNotEmpty($result['failures'][0]['reason']);
    }

    public function test_bulk_work_writes_the_same_audit_trail_as_doing_it_one_at_a_time(): void
    {
        $job = $this->job();
        $one = $this->apply($job, $this->applicant('One', '01055555555', 'one@example.test'));
        $two = $this->apply($job, $this->applicant('Two', '01066666666', 'two@example.test'));

        app(BulkRecruitmentService::class)->execute(
            $this->companyId, 'archive', [(string) $one->id, (string) $two->id], ['reason' => 'Season ended'], 5
        );

        $archived = ApplicantTimelineEvent::where('company_id', $this->companyId)
            ->where('event_type', TimelineEventType::Archived->value)->get();

        $this->assertCount(2, $archived);
        $this->assertSame(5, $archived[0]->actor_id);
        $this->assertSame('bulk', $archived[0]->context['via']);
    }

    public function test_archiving_is_not_rejecting(): void
    {
        $application = $this->apply($this->job(), $this->applicant());

        app(BulkRecruitmentService::class)->execute($this->companyId, 'archive', [(string) $application->id]);

        $fresh = $application->fresh();
        $this->assertNotNull($fresh->archived_at);
        // The status machine is untouched, so the funnel does not record a
        // rejection that never happened.
        $this->assertSame(ApplicationStatus::InPipeline, $fresh->status);
    }

    public function test_a_bulk_selection_is_capped(): void
    {
        $ids = array_map(fn (int $i) => 'id-'.$i, range(1, BulkRecruitmentService::MAX_SELECTION + 1));

        $this->expectException(RecruitmentException::class);
        app(BulkRecruitmentService::class)->execute($this->companyId, 'archive', $ids);
    }

    public function test_an_unknown_bulk_action_is_refused(): void
    {
        $this->expectException(RecruitmentException::class);
        app(BulkRecruitmentService::class)->execute($this->companyId, 'delete_everything', ['x']);
    }

    public function test_the_bulk_preview_names_the_candidates_before_anything_happens(): void
    {
        $application = $this->apply($this->job(), $this->applicant('Named Person', '01077777777', 'n@example.test'));

        $preview = app(BulkRecruitmentService::class)->preview($this->companyId, 'reject', [(string) $application->id]);

        $this->assertSame(1, $preview['selected']);
        $this->assertSame('Named Person', $preview['candidates'][0]['name']);
        $this->assertFalse($preview['is_reversible']);
    }

    public function test_export_reads_and_changes_nothing(): void
    {
        $application = $this->apply($this->job(), $this->applicant());

        $before = ApplicantTimelineEvent::where('company_id', $this->companyId)->count();
        $result = app(BulkRecruitmentService::class)->execute($this->companyId, 'export', [(string) $application->id]);
        $after = ApplicantTimelineEvent::where('company_id', $this->companyId)->count();

        $this->assertSame(1, $result['succeeded']);
        $this->assertNotEmpty($result['columns']);
        $this->assertSame($before, $after);
    }

    // ═══ PART 2 — RECRUITMENT ANALYTICS ══════════════════════════════════════

    public function test_analytics_reports_every_rate_with_its_denominator(): void
    {
        $job = $this->job();
        $this->apply($job, $this->applicant('A', '01088888881', 'a@example.test'));
        $this->apply($job, $this->applicant('B', '01088888882', 'b@example.test'));

        $data = app(RecruitmentAnalyticsService::class)->dashboard($this->companyId);

        $this->assertSame(2, $data['kpis']['applications']);
        $this->assertSame(2, $data['kpis']['offer_rate']['denominator']);
        $this->assertTrue($data['kpis']['offer_rate']['is_measurable']);
        // Nothing has been offered, so the numerator is genuinely zero.
        $this->assertSame(0, $data['kpis']['offer_rate']['numerator']);
    }

    public function test_a_rate_with_no_sample_is_unmeasurable_rather_than_zero(): void
    {
        $data = app(RecruitmentAnalyticsService::class)->dashboard($this->companyId);

        // No offers were made, so the acceptance rate has nothing to divide by —
        // and reporting 0% would read as "everybody turned us down".
        $this->assertFalse($data['kpis']['acceptance_rate']['is_measurable']);
        $this->assertNull($data['kpis']['acceptance_rate']['percent']);
    }

    public function test_the_funnel_shows_where_candidates_are_lost(): void
    {
        $job = $this->job();
        $hired = $this->acceptedApplication([], $job);
        $this->fullOffer($hired);
        $this->apply($job, $this->applicant('Not Progressed', '01099999999', 'np@example.test'));

        $data = app(RecruitmentAnalyticsService::class)->dashboard($this->companyId);
        $funnel = collect($data['funnel'])->keyBy('key');

        $this->assertSame(2, $funnel['applied']['count']);
        $this->assertSame(1, $funnel['accepted']['count']);
        $this->assertSame(50.0, $funnel['accepted']['share_of_total']);
    }

    public function test_trend_buckets_render_quiet_months_as_zero(): void
    {
        $data = app(RecruitmentAnalyticsService::class)->dashboard($this->companyId);

        $this->assertCount(12, $data['trend']);
        $this->assertSame(0, $data['trend'][0]['applications']);
    }

    public function test_source_effectiveness_separates_volume_from_hires(): void
    {
        $job = $this->job();
        $this->apply($job, $this->applicant('Ref A', '01012121212', 'ra@example.test'), ['source' => 'referral']);

        $sources = app(RecruitmentAnalyticsService::class)->dashboard($this->companyId)['source_effectiveness'];

        $this->assertNotEmpty($sources);
        $this->assertArrayHasKey('hire_rate', $sources[0]);
        $this->assertArrayHasKey('applications', $sources[0]);
    }

    // ═══ PART 3 — THE HIRE GATE ══════════════════════════════════════════════

    public function test_hiring_requires_an_accepted_offer(): void
    {
        $application = $this->acceptedApplication();

        // Accepted, but nothing was agreed: no salary, no start date, no offer.
        $this->expectException(RecruitmentException::class);
        app(\Modules\Hr\Recruitment\Domain\Services\HiringService::class)
            ->hire($application, ['basic_salary' => 9000]);
    }

    public function test_hiring_succeeds_once_the_offer_is_accepted(): void
    {
        $application = $this->acceptedApplication();
        $this->fullOffer($application, ['basic_salary' => 11500]);

        $employee = app(\Modules\Hr\Recruitment\Domain\Services\HiringService::class)
            ->hire($application->refresh(), ['basic_salary' => 11500]);

        $this->assertStringStartsWith('EMP-', (string) $employee->employee_number);
    }

    // ═══ PART 5 — EMPLOYEE EXIT ══════════════════════════════════════════════

    public function test_an_exit_lays_out_its_checklist_when_it_is_opened(): void
    {
        $exit = $this->exit();

        $this->assertStringStartsWith('EXT-', (string) $exit->reference);
        $this->assertCount(count(ExitProcessService::DEFAULT_CHECKLIST), $exit->items()->get());
        $this->assertGreaterThan(0, $exit->blockingItems()->count());
    }

    public function test_an_exit_cannot_complete_while_a_mandatory_item_is_outstanding(): void
    {
        $exit = $this->exit();

        $this->assertFalse($exit->canComplete());
        $this->expectException(RecruitmentException::class);
        app(ExitProcessService::class)->complete($exit);
    }

    public function test_an_optional_item_does_not_block_the_exit(): void
    {
        $exit = $this->exit();
        $this->settleMandatoryItems($exit);

        $optionalOutstanding = $exit->items()->where('is_mandatory', false)
            ->where('status', 'pending')->count();

        $this->assertGreaterThan(0, $optionalOutstanding);
        $this->assertTrue($exit->refresh()->canComplete());
    }

    public function test_completing_an_exit_ends_employment_through_the_lifecycle_service(): void
    {
        $exit = $this->exit();
        $this->settleMandatoryItems($exit);

        app(ExitProcessService::class)->complete($exit->refresh(), ['is_rehire_eligible' => true], 3);

        $employee = $exit->employee->refresh();
        $this->assertSame('resigned', $employee->status->value);

        // Written by the one service that owns employment history.
        $event = \Modules\Hr\Recruitment\Domain\Models\EmployeeLifecycleEvent::query()
            ->where('employee_id', $employee->id)
            ->where('event_type', LifecycleEventType::Resigned->value)
            ->first();

        $this->assertNotNull($event);
        $this->assertTrue((bool) $exit->refresh()->is_rehire_eligible);
    }

    public function test_waiving_a_mandatory_item_requires_a_reason_and_records_who_did_it(): void
    {
        $exit = $this->exit();
        $item = $exit->items()->where('is_mandatory', true)->first();

        try {
            app(ExitProcessService::class)->waiveItem($item, '   ');
            $this->fail('A mandatory item was waived without a reason.');
        } catch (RecruitmentException) {
            // Expected.
        }

        app(ExitProcessService::class)->waiveItem($item->refresh(), 'Laptop was written off', 11);

        $fresh = $item->refresh();
        $this->assertSame('waived', $fresh->status->value);
        $this->assertSame('Laptop was written off', $fresh->waiver_reason);
        $this->assertSame(11, $fresh->waived_by);
        $this->assertFalse($fresh->isBlocking());
    }

    public function test_not_applicable_is_not_the_same_as_waived(): void
    {
        $exit = $this->exit();
        $item = $exit->items()->where('is_mandatory', true)->first();

        app(ExitProcessService::class)->markItemNotApplicable($item, 'Driver — never issued a laptop');

        $fresh = $item->refresh();
        $this->assertSame('not_applicable', $fresh->status->value);
        // No waiver reason, because nothing was let go.
        $this->assertNull($fresh->waiver_reason);
    }

    public function test_an_employee_cannot_have_two_open_exits(): void
    {
        $exit = $this->exit();

        $this->expectException(RecruitmentException::class);
        app(ExitProcessService::class)->initiate($exit->employee, ExitType::Termination, [
            'last_working_day' => '2026-08-01',
        ]);
    }

    public function test_a_completed_exit_cannot_be_reopened(): void
    {
        $exit = $this->exit();
        $this->settleMandatoryItems($exit);
        app(ExitProcessService::class)->complete($exit->refresh());

        $this->expectException(RecruitmentException::class);
        app(ExitProcessService::class)->complete($exit->refresh());
    }

    public function test_retirement_is_recorded_as_retirement_not_as_dismissal(): void
    {
        $employee = $this->employee('Retiring', 'Person');
        $exit = app(ExitProcessService::class)->initiate($employee, ExitType::Retirement, [
            'last_working_day' => '2026-07-31', 'reason' => 'Reached retirement age',
        ]);

        $this->settleMandatoryItems($exit);
        app(ExitProcessService::class)->complete($exit->refresh());

        $event = \Modules\Hr\Recruitment\Domain\Models\EmployeeLifecycleEvent::query()
            ->where('employee_id', $employee->id)->latest('created_at')->first();

        // A forty-year career and a disciplinary exit do not share a word.
        $this->assertNotSame(LifecycleEventType::Terminated, $event->event_type);
    }

    // ═══ PART 6 — EXPLAINABILITY ═════════════════════════════════════════════

    public function test_the_commission_preview_shows_metric_rule_calculation_and_amount(): void
    {
        [$employee, $period] = $this->commissionSetup();

        $preview = app(CommissionPreviewService::class)->forPeriod($period);

        $this->assertSame(1, $preview['employees_with_commission']);
        $line = $preview['employees'][0]['lines'][0];

        $this->assertSame('commerce.sales_amount', $line['metric']['key']);
        $this->assertSame(12500.0, $line['metric']['measured_value']);
        $this->assertSame(2.0, $line['rule']['rate']);
        // The sum, written as a person would write it.
        $this->assertSame('12,500.00 × 2% = 250.00', $line['calculation']['worked']);
        $this->assertSame(250.0, $line['commission']);
    }

    public function test_the_preview_writes_nothing(): void
    {
        [, $period] = $this->commissionSetup();

        $before = PayrollRun::where('company_id', $this->companyId)->count();
        app(CommissionPreviewService::class)->forPeriod($period);
        $after = PayrollRun::where('company_id', $this->companyId)->count();

        $this->assertSame($before, $after);
    }

    public function test_every_payslip_line_exposes_a_formula_inputs_a_source_and_a_calculation(): void
    {
        [, $period] = $this->commissionSetup();

        app(PayrollRunService::class)->openPeriod($period);
        $run = app(PayrollRunService::class)->calculate($period->refresh());
        $payslip = $run->payslips()->firstOrFail();

        $explained = app(PayslipExplainerService::class)->explain($payslip);

        $this->assertNotEmpty($explained['lines']);

        foreach ($explained['lines'] as $line) {
            $this->assertNotEmpty($line['formula'], 'Every line must state its formula.');
            $this->assertNotEmpty($line['inputs'], 'Every line must state its inputs.');
            $this->assertNotEmpty($line['source']['label'], 'Every line must name its source.');
            $this->assertNotEmpty($line['calculation']['worked'], 'Every line must show its arithmetic.');
        }

        $this->assertStringContainsString('=', $explained['net_worked']);
    }

    public function test_a_kpi_fact_can_be_traced_to_its_document_and_its_import_date(): void
    {
        [$employee] = $this->commissionSetup();

        $trace = app(KpiFactService::class)->traceability(
            $this->companyId, (string) $employee->id, KpiMetric::SalesAmount->value,
            '2026-06-01', '2026-06-30',
        );

        $this->assertSame(1, $trace['facts_total']);
        $fact = $trace['facts'][0];

        $this->assertSame('commerce', $fact['source_module']);
        $this->assertSame('sales_order', $fact['source_document_type']);
        $this->assertSame('SO-1001', $fact['source_document_number']);
        $this->assertNotNull($fact['event_date']);
        $this->assertNotNull($fact['imported_date']);
        $this->assertFalse($trace['is_truncated']);
    }

    public function test_a_bonus_records_what_was_recommended_beside_what_was_approved(): void
    {
        $employee = $this->employee();

        $bonus = app(BonusService::class)->award($employee, [
            'type' => BonusType::Performance->value,
            'amount' => 3000,
            'recommended_amount' => 2500,
            'reason' => 'Q2 performance',
            'awarded_on' => '2026-06-10',
        ]);

        app(BonusService::class)->approve($bonus, 4, 'Exceeded on retention as well');

        $audit = app(BonusService::class)->decisionAudit($bonus->refresh());

        $this->assertSame(2500.0, $audit['recommended_amount']);
        $this->assertSame(3000.0, $audit['approved_amount']);
        $this->assertSame(500.0, $audit['difference']);
        $this->assertSame(20.0, $audit['difference_percent']);
        $this->assertFalse($audit['followed_recommendation']);
        $this->assertSame('Exceeded on retention as well', $audit['approval_reason']);
        $this->assertSame(4, $audit['approver']);
        $this->assertNotNull($audit['approval_date']);
    }

    // ═══ PART 7 — COMPENSATION PROTECTION ════════════════════════════════════

    public function test_a_bonus_cannot_be_awarded_against_approved_payroll(): void
    {
        [$employee, $period] = $this->approvedPayroll();

        $this->expectException(CompensationException::class);
        app(BonusService::class)->award($employee, [
            'amount' => 1000, 'reason' => 'Late', 'awarded_on' => $period->start_date->toDateString(),
        ]);
    }

    public function test_a_deduction_cannot_be_raised_against_approved_payroll(): void
    {
        [$employee, $period] = $this->approvedPayroll();

        $this->expectException(CompensationException::class);
        app(DeductionService::class)->raise($employee, [
            'amount' => 500, 'reason' => 'Late', 'deduction_date' => $period->start_date->toDateString(),
        ]);
    }

    public function test_the_lock_names_the_period_and_offers_the_remedy(): void
    {
        [, $period] = $this->approvedPayroll();

        $explained = app(CompensationLockService::class)->explain(
            $this->companyId, $period->start_date->toDateString()
        );

        $this->assertTrue($explained['is_locked']);
        $this->assertSame($period->code, $explained['period']['code']);
        // A refusal that does not say what to do instead just gets worked around.
        $this->assertStringContainsString('adjustment', strtolower((string) $explained['remedy']));
    }

    public function test_an_unapproved_period_is_not_locked(): void
    {
        $employee = $this->employee();
        $this->period('2026-07');

        $this->assertFalse(app(CompensationLockService::class)->isLocked($this->companyId, '2026-07-10'));

        // And the ordinary path still works.
        $bonus = app(BonusService::class)->award($employee, [
            'amount' => 1000, 'reason' => 'On time', 'awarded_on' => '2026-07-10',
        ]);
        $this->assertNotNull($bonus->id);
    }

    public function test_an_adjustment_corrects_approved_pay_without_touching_the_original(): void
    {
        [$employee, $locked] = $this->approvedPayroll();
        $open = $this->period('2026-07');

        $adjustment = app(CompensationAdjustmentService::class)->raise(
            $employee,
            AdjustmentComponent::Bonus,
            [
                'amount' => 750,
                'reason' => 'Q2 bonus was understated',
                'original_period_id' => (string) $locked->id,
                'original_amount' => 2000,
            ],
            6,
        );

        $this->assertStringStartsWith('ADJ-', (string) $adjustment->reference);
        // Carried by the OPEN period, not the locked one.
        $this->assertSame((string) $open->id, (string) $adjustment->payroll_period_id);
        $this->assertSame((string) $locked->id, (string) $adjustment->original_period_id);

        $audit = $adjustment->auditTrail();
        $this->assertSame(2000.0, $audit['corrects']['amount']);
        $this->assertSame('pays more', $audit['direction']);
    }

    public function test_an_adjustment_requires_a_reason(): void
    {
        [$employee] = $this->approvedPayroll();
        $this->period('2026-07');

        $this->expectException(CompensationException::class);
        app(CompensationAdjustmentService::class)->raise(
            $employee, AdjustmentComponent::Bonus, ['amount' => 100, 'reason' => '  ']
        );
    }

    public function test_raising_and_approving_an_adjustment_are_recorded_separately(): void
    {
        [$employee] = $this->approvedPayroll();
        $this->period('2026-07');

        $adjustment = app(CompensationAdjustmentService::class)->raise(
            $employee, AdjustmentComponent::Deduction, ['amount' => -300, 'reason' => 'Overpaid'], 6
        );

        app(CompensationAdjustmentService::class)->approve($adjustment, 9, 'Confirmed against the ledger');

        $audit = $adjustment->refresh()->auditTrail();
        $this->assertSame(6, $audit['requested_by']);
        $this->assertSame(9, $audit['approved_by']);
        $this->assertSame('recovers', $audit['direction']);
        $this->assertSame('approved', $audit['status']);
    }

    public function test_an_adjustment_cannot_be_carried_by_an_approved_period(): void
    {
        [$employee, $locked] = $this->approvedPayroll();

        $this->expectException(CompensationException::class);
        app(CompensationAdjustmentService::class)->raise(
            $employee,
            AdjustmentComponent::Bonus,
            ['amount' => 500, 'reason' => 'Late', 'payroll_period_id' => (string) $locked->id],
        );
    }

    // ═══ PART 8 — COMMISSION RULE VERSIONING ═════════════════════════════════

    public function test_a_rate_cannot_be_edited_in_place(): void
    {
        $rule = $this->commissionRule();

        $this->expectException(CompensationException::class);
        app(CommissionRuleService::class)->update($rule, ['rate' => 3.0]);
    }

    public function test_a_name_can_still_be_corrected_in_place(): void
    {
        $rule = $this->commissionRule();

        $updated = app(CommissionRuleService::class)->update($rule, ['name' => 'Sales Commission (Retail)']);

        // Fixing a typo moves nobody's money.
        $this->assertSame('Sales Commission (Retail)', $updated->name);
        $this->assertSame(1, (int) $updated->version);
    }

    public function test_changing_a_rate_appends_a_version_and_closes_the_previous_one(): void
    {
        $rule = $this->commissionRule(['effective_from' => '2026-01-01']);

        $successor = app(CommissionRuleService::class)->newVersion($rule, ['rate' => 3.0], '2026-07-01');

        $this->assertSame(2, (int) $successor->version);
        $this->assertSame(3.0, (float) $successor->rate);
        $this->assertSame((string) $rule->id, (string) $successor->supersedes_rule_id);

        $previous = $rule->refresh();
        $this->assertSame(2.0, (float) $previous->rate, 'The original rate must survive untouched.');
        // Closed the day BEFORE, so no date resolves to two rules.
        $this->assertSame('2026-06-30', $previous->effective_to->toDateString());
        $this->assertNotNull($previous->superseded_at);
    }

    public function test_historical_payroll_keeps_paying_at_the_rate_that_was_in_force(): void
    {
        [$employee, $period] = $this->commissionSetup();
        $rule = CommissionRule::where('company_id', $this->companyId)->firstOrFail();

        // June measured at 2% → 250.
        $before = app(CommissionPreviewService::class)->forEmployee($employee, '2026-06-01', '2026-06-30');
        $this->assertSame(250.0, $before['total']);

        app(CommissionRuleService::class)->newVersion($rule, ['rate' => 10.0], '2026-07-01');

        // June still pays 250. The row it was calculated from is still there.
        $after = app(CommissionPreviewService::class)->forEmployee($employee, '2026-06-01', '2026-06-30');
        $this->assertSame(250.0, $after['total'], 'A new rate must never reach backwards into a closed month.');
        $this->assertSame(2.0, $after['lines'][0]['rule']['rate']);
        $this->assertSame(1, $after['lines'][0]['rule']['version']);

        unset($period);
    }

    public function test_a_new_version_cannot_be_backdated_into_approved_payroll(): void
    {
        [, $locked] = $this->approvedPayroll();
        $rule = $this->commissionRule();

        $this->expectException(CompensationException::class);
        app(CommissionRuleService::class)->newVersion($rule, ['rate' => 5.0], $locked->start_date->toDateString());
    }

    public function test_the_version_history_shows_every_rate_the_rule_ever_had(): void
    {
        $rule = $this->commissionRule(['effective_from' => '2026-01-01']);
        $v2 = app(CommissionRuleService::class)->newVersion($rule, ['rate' => 3.0], '2026-07-01');
        app(CommissionRuleService::class)->newVersion($v2, ['rate' => 4.0], '2026-09-01');

        $history = app(CommissionRuleService::class)->versionHistory($rule->refresh());

        $this->assertSame(3, $history['current_version']);
        $this->assertSame([2.0, 3.0, 4.0], array_column($history['versions'], 'rate'));
        $this->assertTrue($history['versions'][2]['is_current']);
        $this->assertFalse($history['versions'][0]['is_current']);
    }

    public function test_the_version_in_force_on_a_date_can_be_looked_up(): void
    {
        $rule = $this->commissionRule(['effective_from' => '2026-01-01']);
        app(CommissionRuleService::class)->newVersion($rule, ['rate' => 3.0], '2026-07-01');

        $rules = app(CommissionRuleService::class);

        $this->assertSame(2.0, (float) $rules->versionInForceOn($rule->refresh(), '2026-06-15')->rate);
        $this->assertSame(3.0, (float) $rules->versionInForceOn($rule->refresh(), '2026-07-15')->rate);
    }

    public function test_the_administration_list_shows_only_current_versions(): void
    {
        $rule = $this->commissionRule(['effective_from' => '2026-01-01']);
        app(CommissionRuleService::class)->newVersion($rule, ['rate' => 3.0], '2026-07-01');

        $listed = app(CommissionRuleService::class)->forCompany($this->companyId);

        // Eleven versions of one scheme in a settings list is how the wrong one
        // gets edited.
        $this->assertCount(1, $listed);
        $this->assertSame(2, (int) $listed->first()->version);
    }

    // ═══ HELPERS ═════════════════════════════════════════════════════════════

    private function seedStages(): void
    {
        $stages = [
            ['applied', 'Applied', 1, 'applied', true, false],
            ['interview', 'Interview', 2, 'interview', false, false],
            ['accepted', 'Accepted', 3, 'decision', false, true],
        ];

        foreach ($stages as [$code, $name, $seq, $type, $initial, $terminal]) {
            RecruitmentStage::create([
                'company_id' => $this->companyId, 'code' => $code, 'name' => $name,
                'sequence' => $seq, 'type' => $type,
                'is_initial' => $initial, 'is_terminal' => $terminal, 'is_active' => true,
            ]);
        }
    }

    /** The catalogue the migration seeds, recreated for this test company. */
    private function seedTags(): void
    {
        foreach ([['vip', 'VIP', 'violet'], ['urgent', 'Urgent', 'red'], ['referred', 'Referred', 'blue']] as [$key, $name, $color]) {
            ApplicantTag::create([
                'company_id' => $this->companyId, 'key' => $key, 'name' => $name,
                'color' => $color, 'is_active' => true, 'sequence' => 10,
            ]);
        }
    }

    private function tag(string $key): ApplicantTag
    {
        return ApplicantTag::where('company_id', $this->companyId)->where('key', $key)->firstOrFail();
    }

    private function job(array $data = []): JobOpening
    {
        $job = app(JobOpeningService::class)->create($this->companyId, array_merge([
            'title' => 'Sales Representative', 'openings_count' => 5,
            'salary_min' => 8000, 'salary_max' => 14000,
        ], $data));

        return app(JobOpeningService::class)->publish($job);
    }

    private function applicant(
        string $name = 'Amir Hassan',
        string $mobile = '01001234567',
        ?string $email = 'amir@example.test',
    ): Applicant {
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

    /** A candidacy the company has decided on, ready for an offer. */
    private function acceptedApplication(array $jobData = [], ?JobOpening $job = null): JobApplication
    {
        $application = $this->apply($job ?? $this->job($jobData), $this->applicant());
        app(JobApplicationService::class)->decide($application, ApplicationStatus::Accepted);

        return $application->refresh();
    }

    private function draftOffer(array $terms = []): Offer
    {
        return app(OfferService::class)->draft(
            $this->acceptedApplication(),
            array_merge(['basic_salary' => 12000, 'start_date' => '2026-07-01'], $terms),
        );
    }

    /** Draft, send and accept in one go. */
    private function fullOffer(JobApplication $application, array $terms = []): Offer
    {
        $offers = app(OfferService::class);
        $offer = $offers->draft($application, array_merge(['basic_salary' => 12000], $terms));
        $offers->send($offer);

        return $offers->accept($offer->refresh());
    }

    private function employee(string $first = 'Nour', string $last = 'Adel'): Employee
    {
        return app(EmployeeService::class)->create($this->companyId, [
            'first_name' => $first, 'last_name' => $last, 'hire_date' => '2024-01-01',
        ]);
    }

    private function exit(): \Modules\Hr\Recruitment\Domain\Models\ExitProcess
    {
        return app(ExitProcessService::class)->initiate(
            $this->employee(),
            ExitType::Resignation,
            ['last_working_day' => '2026-07-31', 'reason' => 'Moving abroad', 'notice_date' => '2026-06-15'],
        );
    }

    private function settleMandatoryItems(\Modules\Hr\Recruitment\Domain\Models\ExitProcess $exit): void
    {
        $exit->items()->where('is_mandatory', true)->get()
            ->each(fn (ExitChecklistItem $item) => app(ExitProcessService::class)->completeItem($item));
    }

    private function period(string $code): PayrollPeriod
    {
        return app(PayrollRunService::class)->createPeriod($this->companyId, [
            'code' => $code,
            'start_date' => $code.'-01',
            'end_date' => Carbon::parse($code.'-01')->endOfMonth()->toDateString(),
        ]);
    }

    private function commissionRule(array $data = []): CommissionRule
    {
        return app(CommissionRuleService::class)->create($this->companyId, array_merge([
            'code' => 'SALES-PCT',
            'name' => 'Sales Commission',
            'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value,
            'rate' => 2.0,
            'applies_to' => 'all',
        ], $data));
    }

    /**
     * An employee with a salary, a commission rule and one traceable sales fact.
     *
     * @return array{0: Employee, 1: PayrollPeriod}
     */
    private function commissionSetup(): array
    {
        $employee = $this->employee();
        $period = $this->period('2026-06');

        app(SalaryStructureService::class)->assign($employee, 8000, ['effective_from' => '2026-01-01']);
        $this->commissionRule(['effective_from' => '2026-01-01']);

        $facts = app(KpiFactService::class);
        $event = $facts->eventFromPayload($this->companyId, [
            'metric_key' => KpiMetric::SalesAmount->value,
            'employee_id' => (string) $employee->id,
            'value' => 12500,
            'quantity' => 1,
            'occurred_at' => '2026-06-20 12:00:00',
            'source_reference' => 'order-uuid-1001',
            'idempotency_key' => 'commerce:order:1001',
            // Traceability travels in the metadata — naming a document type is not
            // importing the module that owns it.
            'metadata' => ['document_type' => 'sales_order', 'document_number' => 'SO-1001'],
        ]);

        $facts->record($event);

        return [$employee, $period];
    }

    /**
     * A period whose payroll has been calculated and approved — the locked state.
     *
     * @return array{0: Employee, 1: PayrollPeriod}
     */
    private function approvedPayroll(): array
    {
        $employee = $this->employee();
        $period = $this->period('2026-06');

        app(SalaryStructureService::class)->assign($employee, 8000, ['effective_from' => '2026-01-01']);

        app(PayrollRunService::class)->openPeriod($period);
        $run = app(PayrollRunService::class)->calculate($period->refresh());
        app(PayrollRunService::class)->approve($run, 1);

        $this->assertSame(PayrollRunStatus::Approved, $run->refresh()->status);

        return [$employee, $period->refresh()];
    }
}
