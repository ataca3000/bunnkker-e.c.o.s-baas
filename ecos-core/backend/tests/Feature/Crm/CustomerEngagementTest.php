<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Engagement\Domain\Enums\ActivityType;
use Modules\Crm\Engagement\Domain\Enums\TaskType;
use Modules\Crm\Engagement\Domain\Models\CustomerActivity;
use Modules\Crm\Engagement\Domain\Services\ActivityService;
use Modules\Crm\Engagement\Domain\Services\CustomerJourneyService;
use Modules\Crm\Engagement\Domain\Services\TaskService;
use Modules\Crm\Engagement\Domain\Services\TimelineService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM & Customer Service OS — EPIC C2. Customer Engagement.
 *
 * Protects the engagement guarantees: the CRM's activity log is append-only;
 * every interaction (CRM-logged and read from existing systems) appears on the
 * timeline exactly once; the journey derives from it; and the module reads
 * external systems without importing or duplicating them.
 */
class CustomerEngagementTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
        $this->customer = app(CustomerService::class)->create($this->companyId, CustomerType::Individual, ['first_name' => 'Timeline', 'last_name' => 'Test']);
    }

    private function cid(): string
    {
        return (string) $this->customer->id;
    }

    // ═══ ACTIVITIES ════════════════════════════════════════════════════════════

    public function test_logged_activity_appears_on_the_timeline(): void
    {
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, [
            'subject' => 'Intro call', 'direction' => 'outbound', 'occurred_at' => Carbon::now()->subHour(),
        ]);

        $timeline = app(TimelineService::class)->timeline($this->companyId, $this->cid());
        $this->assertSame(1, $timeline['total']);
        $this->assertSame('call', $timeline['entries'][0]['type']);
        $this->assertSame('Intro call', $timeline['entries'][0]['title']);
        $this->assertSame('phone', $timeline['entries'][0]['channel']);
    }

    public function test_the_activity_log_is_append_only(): void
    {
        $activity = app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Email, ['subject' => 'x']);

        $activity->subject = 'changed';
        $this->assertFalse($activity->save());
        $this->assertFalse($activity->delete());
    }

    // ═══ TASKS (lifecycle written to the append-only timeline) ═════════════════

    public function test_task_lifecycle_is_recorded_on_the_timeline(): void
    {
        $task = app(TaskService::class)->create($this->companyId, $this->cid(), TaskType::FollowUp, ['title' => 'Call back'], 1);
        app(TaskService::class)->complete($task, 2);

        // Two append-only system activities: created + completed.
        $systemActivities = CustomerActivity::query()->where('customer_id', $this->cid())->where('activity_type', 'system')->count();
        $this->assertSame(2, $systemActivities);

        $timeline = app(TimelineService::class)->timeline($this->companyId, $this->cid());
        $titles = array_column($timeline['entries'], 'title');
        $this->assertContains('Follow Up created: Call back', $titles);
        $this->assertContains('Follow Up completed: Call back', $titles);
    }

    // ═══ READS FROM EXISTING SYSTEMS (no duplication) ══════════════════════════

    public function test_a_crm_note_is_read_into_the_timeline(): void
    {
        // A note captured by the Customer Foundation (C1) surfaces on the timeline.
        DB::table('crm_customer_notes')->insert([
            'id' => (string) Str::uuid(), 'customer_id' => $this->cid(), 'body' => 'Called earlier', 'is_pinned' => false,
            'created_at' => Carbon::now()->subDays(2), 'updated_at' => Carbon::now()->subDays(2),
        ]);

        $timeline = app(TimelineService::class)->timeline($this->companyId, $this->cid());
        $note = collect($timeline['entries'])->firstWhere('type', 'note');
        $this->assertNotNull($note);
        $this->assertSame('crm', $note['source']);
        $this->assertSame('Called earlier', $note['body']);
    }

    public function test_an_order_is_read_into_the_timeline(): void
    {
        DB::table('orders')->insert([
            'id' => (string) Str::uuid(), 'customer_id' => $this->cid(), 'order_number' => 'ORD-'.substr((string) Str::uuid(), 0, 8),
            'order_date' => Carbon::now()->subDay()->toDateString(), 'status' => 'delivered', 'subtotal' => 100, 'total' => 100,
            'created_at' => Carbon::now()->subDay(), 'updated_at' => Carbon::now()->subDay(),
        ]);

        $timeline = app(TimelineService::class)->timeline($this->companyId, $this->cid());
        $order = collect($timeline['entries'])->firstWhere('type', 'order');
        $this->assertNotNull($order);
        $this->assertSame('commerce', $order['source']);
    }

    public function test_a_conversation_is_read_into_the_timeline(): void
    {
        DB::table('cep_conversations')->insert([
            'id' => (string) Str::uuid(), 'conversation_uuid' => (string) Str::uuid(), 'provider' => 'whatsapp',
            'customer_id' => $this->cid(), 'company_id' => $this->companyId, 'status' => 'open',
            'started_at' => Carbon::now()->subHours(3), 'created_at' => Carbon::now()->subHours(3), 'updated_at' => Carbon::now()->subHours(3),
        ]);

        $timeline = app(TimelineService::class)->timeline($this->companyId, $this->cid());
        $conv = collect($timeline['entries'])->firstWhere('type', 'conversation');
        $this->assertNotNull($conv);
        $this->assertSame('customer_engagement', $conv['source']);
        $this->assertSame('whatsapp', $conv['channel']);
    }

    // ═══ FEED / INTERACTIONS / JOURNEY ═════════════════════════════════════════

    public function test_interaction_history_excludes_system_events(): void
    {
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, ['subject' => 'real']);
        app(TaskService::class)->create($this->companyId, $this->cid(), TaskType::Task, ['title' => 't'], 1); // logs a system activity

        $all = app(TimelineService::class)->timeline($this->companyId, $this->cid())['total'];
        $interactions = app(TimelineService::class)->interactions($this->companyId, $this->cid())['total'];

        $this->assertSame(2, $all);           // call + system
        $this->assertSame(1, $interactions);  // system excluded
    }

    public function test_omnichannel_feed_summarises_channels_and_sources(): void
    {
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Whatsapp, ['subject' => 'w']);
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, ['subject' => 'c']);

        $feed = app(TimelineService::class)->feed($this->companyId, $this->cid());
        $this->assertArrayHasKey('channels', $feed);
        $this->assertArrayHasKey('sources', $feed);
        $this->assertSame(1, $feed['channels']['whatsapp']);
        $this->assertSame(1, $feed['channels']['phone']);
    }

    public function test_journey_derives_stage_from_the_timeline(): void
    {
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, ['subject' => 'c', 'occurred_at' => Carbon::now()->subDays(5)]);
        DB::table('orders')->insert([
            'id' => (string) Str::uuid(), 'customer_id' => $this->cid(), 'order_number' => 'ORD-'.substr((string) Str::uuid(), 0, 8),
            'order_date' => Carbon::now()->subDays(3)->toDateString(), 'status' => 'delivered', 'subtotal' => 50, 'total' => 50,
            'created_at' => Carbon::now()->subDays(3), 'updated_at' => Carbon::now()->subDays(3),
        ]);

        $journey = app(CustomerJourneyService::class)->journey($this->companyId, $this->cid());
        $this->assertSame('active', $journey['stage']); // ordered + recently engaged
        $this->assertSame(1, $journey['engagement']['total_orders']);
        $this->assertNotEmpty($journey['milestones']);
    }

    public function test_timeline_is_sorted_newest_first(): void
    {
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, ['subject' => 'old', 'occurred_at' => Carbon::now()->subDays(10)]);
        app(ActivityService::class)->log($this->companyId, $this->cid(), ActivityType::Call, ['subject' => 'new', 'occurred_at' => Carbon::now()->subDay()]);

        $entries = app(TimelineService::class)->timeline($this->companyId, $this->cid())['entries'];
        $this->assertSame('new', $entries[0]['title']);
        $this->assertSame('old', $entries[1]['title']);
    }

    // ═══ SECURITY & ARCHITECTURE ═══════════════════════════════════════════════

    public function test_engagement_routes_require_authentication(): void
    {
        $this->getJson("/api/crm/customers/{$this->cid()}/timeline")->assertUnauthorized();
        $this->postJson("/api/crm/customers/{$this->cid()}/activities", [])->assertUnauthorized();
    }

    public function test_engagement_module_reads_but_does_not_import_other_modules(): void
    {
        $dir = base_path('Modules/Crm/Engagement');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $source = (string) file_get_contents($file->getPathname());
            foreach (['use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Logistics', 'use Modules\\Marketing', 'use Modules\\POS', 'use Modules\\Sales', 'use Modules\\CustomerEngagement'] as $needle) {
                $this->assertStringNotContainsString(
                    $needle, $source,
                    basename($file->getPathname()).' must READ existing systems (by table), not import them ('.$needle.').',
                );
            }
        }
    }
}
