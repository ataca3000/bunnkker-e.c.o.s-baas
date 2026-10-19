<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Service\Domain\Enums\NoteVisibility;
use Modules\Crm\Service\Domain\Enums\TicketStatus;
use Modules\Crm\Service\Domain\Enums\TicketType;
use Modules\Crm\Service\Domain\Exceptions\ServiceException;
use Modules\Crm\Service\Domain\Models\AssignmentRule;
use Modules\Crm\Service\Domain\Models\EscalationRule;
use Modules\Crm\Service\Domain\Models\KbArticle;
use Modules\Crm\Service\Domain\Models\ResolutionTemplate;
use Modules\Crm\Service\Domain\Models\SlaPolicy;
use Modules\Crm\Service\Domain\Models\Ticket;
use Modules\Crm\Service\Domain\Models\TicketEvent;
use Modules\Crm\Service\Domain\Services\AssignmentEngine;
use Modules\Crm\Service\Domain\Services\EscalationEngine;
use Modules\Crm\Service\Domain\Services\KnowledgeBaseService;
use Modules\Crm\Service\Domain\Services\ResolutionLibraryService;
use Modules\Crm\Service\Domain\Services\TicketService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM & Customer Service OS — EPIC C3. Customer Service.
 *
 * Protects the service guarantees: the resolution workflow, the SLA clock, the
 * assignment and escalation engines, the append-only case audit, and the
 * module's independence from Finance/Inventory/Shipping (reference only).
 */
class CustomerServiceTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
        $this->customer = app(CustomerService::class)->create($this->companyId, CustomerType::Individual, ['first_name' => 'Case', 'last_name' => 'Owner']);
    }

    private function cid(): string
    {
        return (string) $this->customer->id;
    }

    private function newTicket(array $data = []): Ticket
    {
        return app(TicketService::class)->create($this->companyId, $this->cid(), TicketType::from($data['type'] ?? 'ticket'), array_merge(['subject' => 'Help'], $data), 1);
    }

    // ═══ TICKETS ═══════════════════════════════════════════════════════════════

    public function test_creating_a_ticket_numbers_it_and_logs_an_event(): void
    {
        $ticket = $this->newTicket(['subject' => 'Broken item']);

        $this->assertStringStartsWith('TKT-', $ticket->ticket_number);
        $this->assertSame(TicketStatus::New, $ticket->status);
        $this->assertSame(1, TicketEvent::query()->where('ticket_id', $ticket->id)->where('event_type', 'created')->count());
    }

    public function test_reference_only_integration_stores_opaque_ids(): void
    {
        $ticket = $this->newTicket(['type' => 'return_rma', 'source_reference' => ['order_id' => 'ord-123', 'product_id' => 'prd-9']]);
        $this->assertSame('ord-123', $ticket->fresh()->source_reference['order_id']);
    }

    // ═══ SLA ═══════════════════════════════════════════════════════════════════

    public function test_sla_policy_stamps_the_response_and_resolution_clock(): void
    {
        SlaPolicy::create(['company_id' => $this->companyId, 'name' => 'High', 'priority' => 'high', 'first_response_minutes' => 60, 'resolution_minutes' => 240, 'is_active' => true]);

        $ticket = $this->newTicket(['priority' => 'high']);
        $this->assertNotNull($ticket->sla_policy_id);
        $this->assertSame(60, (int) $ticket->created_at->diffInMinutes($ticket->first_response_due_at));
        $this->assertSame(240, (int) $ticket->created_at->diffInMinutes($ticket->resolution_due_at));
    }

    // ═══ ASSIGNMENT ════════════════════════════════════════════════════════════

    public function test_assignment_engine_routes_by_rule(): void
    {
        AssignmentRule::create(['company_id' => $this->companyId, 'name' => 'Complaints→5', 'order' => 1, 'match_type' => 'complaint', 'strategy' => 'direct', 'assignee_id' => 5, 'is_active' => true]);

        $ticket = $this->newTicket(['type' => 'complaint']);
        $this->assertSame(5, (int) $ticket->assignee_id);
        $this->assertSame(1, TicketEvent::query()->where('ticket_id', $ticket->id)->where('event_type', 'assigned')->count());
    }

    public function test_round_robin_picks_the_least_loaded_member(): void
    {
        AssignmentRule::create(['company_id' => $this->companyId, 'name' => 'RR', 'order' => 1, 'strategy' => 'round_robin', 'team_member_ids' => [10, 11], 'is_active' => true]);

        $first = $this->newTicket();                    // 10 and 11 both idle → picks 10
        $this->assertSame(10, (int) $first->assignee_id);

        $second = $this->newTicket();                   // 10 now has 1 open → picks 11
        $this->assertSame(11, (int) $second->assignee_id);
    }

    // ═══ WORKFLOW ══════════════════════════════════════════════════════════════

    public function test_resolution_workflow_transitions(): void
    {
        $ticket = $this->newTicket();
        $svc = app(TicketService::class);

        $svc->transition($ticket, TicketStatus::Open, 1);
        $svc->transition($ticket->fresh(), TicketStatus::Resolved, 1);
        $resolved = $ticket->fresh();
        $this->assertSame(TicketStatus::Resolved, $resolved->status);
        $this->assertNotNull($resolved->resolved_at);

        $closed = $svc->transition($resolved, TicketStatus::Closed, 1);
        $this->assertNotNull($closed->closed_at);
    }

    public function test_invalid_transition_is_refused(): void
    {
        $ticket = $this->newTicket();
        $this->expectException(ServiceException::class);
        app(TicketService::class)->transition($ticket, TicketStatus::Closed, 1); // new → closed not allowed
    }

    public function test_a_cancelled_ticket_is_terminal(): void
    {
        $ticket = $this->newTicket();
        $svc = app(TicketService::class);
        $svc->transition($ticket, TicketStatus::Cancelled, 1); // new → cancelled is allowed

        $this->expectException(ServiceException::class);
        $svc->transition($ticket->fresh(), TicketStatus::Open, 1); // cancelled is terminal
    }

    public function test_a_closed_ticket_can_be_reopened(): void
    {
        $ticket = $this->newTicket();
        $svc = app(TicketService::class);
        $svc->transition($ticket, TicketStatus::Open, 1);
        $svc->transition($ticket->fresh(), TicketStatus::Resolved, 1);
        $svc->transition($ticket->fresh(), TicketStatus::Closed, 1);
        $reopened = $svc->transition($ticket->fresh(), TicketStatus::Open, 1);

        $this->assertSame(TicketStatus::Open, $reopened->status);
        $this->assertSame(1, $reopened->reopened_count);
    }

    public function test_reopening_increments_the_counter(): void
    {
        $ticket = $this->newTicket();
        $svc = app(TicketService::class);
        $svc->transition($ticket, TicketStatus::Open, 1);
        $svc->transition($ticket->fresh(), TicketStatus::Resolved, 1);
        $reopened = $svc->transition($ticket->fresh(), TicketStatus::Open, 1);

        $this->assertSame(1, $reopened->reopened_count);
        $this->assertSame(1, TicketEvent::query()->where('ticket_id', $ticket->id)->where('event_type', 'reopened')->count());
    }

    public function test_first_agent_note_stops_the_response_clock(): void
    {
        $ticket = $this->newTicket();
        app(TicketService::class)->addNote($ticket, NoteVisibility::Public, 'On it', 7);
        $this->assertNotNull($ticket->fresh()->first_responded_at);
    }

    public function test_ticket_events_are_append_only(): void
    {
        $ticket = $this->newTicket();
        $event = TicketEvent::query()->where('ticket_id', $ticket->id)->firstOrFail();
        $event->note = 'x';
        $this->assertFalse($event->save());
        $this->assertFalse($event->delete());
    }

    // ═══ ESCALATION ════════════════════════════════════════════════════════════

    public function test_escalation_engine_breaches_and_escalates(): void
    {
        $ticket = $this->newTicket(['priority' => 'high']);
        // Force the response clock into the past, unmet.
        $ticket->update(['first_response_due_at' => Carbon::now()->subHour(), 'first_responded_at' => null]);

        EscalationRule::create(['company_id' => $this->companyId, 'name' => 'FR breach → 99', 'trigger' => 'first_response_breach', 'reassign_to_user_id' => 99, 'is_active' => true]);

        $summary = app(EscalationEngine::class)->evaluate($this->companyId);
        $this->assertSame(1, $summary['first_response_breaches']);
        $this->assertSame(1, $summary['escalated']);

        $fresh = $ticket->fresh();
        $this->assertTrue((bool) $fresh->first_response_breached);
        $this->assertSame(1, $fresh->escalation_level);
        $this->assertSame(99, (int) $fresh->assignee_id);
    }

    // ═══ KNOWLEDGE BASE & RESOLUTION LIBRARY ═══════════════════════════════════

    public function test_knowledge_base_publish_and_search(): void
    {
        $kb = app(KnowledgeBaseService::class);
        $article = $kb->create($this->companyId, ['title' => 'How to return an item', 'body' => 'Steps ...'], 1);
        $this->assertSame('draft', $article->status);

        $kb->publish($article);
        $this->assertSame(1, $kb->search($this->companyId, 'return')->count());
        $this->assertSame('published', KbArticle::find($article->id)->status);
    }

    public function test_applying_a_resolution_posts_a_public_note(): void
    {
        $template = app(ResolutionLibraryService::class)->create($this->companyId, ['title' => 'Refund steps', 'body' => 'We will refund ...'], 1);
        $ticket = $this->newTicket();

        app(ResolutionLibraryService::class)->apply($ticket, $template, 3);

        $this->assertSame(1, $ticket->notes()->where('visibility', 'public')->count());
        $this->assertSame(1, (int) $template->fresh()->usage_count);
    }

    // ═══ SECURITY & ARCHITECTURE ═══════════════════════════════════════════════

    public function test_service_routes_require_authentication(): void
    {
        $this->getJson('/api/crm/service/tickets')->assertUnauthorized();
        $this->postJson('/api/crm/service/tickets', [])->assertUnauthorized();
    }

    public function test_service_module_does_not_import_finance_inventory_or_shipping(): void
    {
        $dir = base_path('Modules/Crm/Service');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $source = (string) file_get_contents($file->getPathname());
            foreach (['use Modules\\Finance', 'use Modules\\Inventory', 'use Modules\\Logistics', 'use Modules\\Shipping', 'use Modules\\Commerce', 'use Modules\\POS', 'use Modules\\Marketing', 'use Modules\\Sales', 'use Modules\\CustomerEngagement', 'use Modules\\Manufacturing'] as $needle) {
                $this->assertStringNotContainsString(
                    $needle, $source,
                    basename($file->getPathname()).' must integrate by reference only — it may not import '.$needle.'.',
                );
            }
        }
    }
}
