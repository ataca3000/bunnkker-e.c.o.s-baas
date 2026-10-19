<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Sales\Domain\Enums\OpportunityStatus;
use Modules\Crm\Sales\Domain\Events\OpportunityCreated;
use Modules\Crm\Sales\Domain\Events\OpportunityLost;
use Modules\Crm\Sales\Domain\Events\OpportunityUpdated;
use Modules\Crm\Sales\Domain\Events\OpportunityWon;
use Modules\Crm\Sales\Domain\Exceptions\SalesException;
use Modules\Crm\Sales\Domain\Models\Opportunity;
use Modules\Crm\Sales\Domain\Models\Pipeline;
use Modules\Crm\Sales\Domain\Models\PipelineStage;

/**
 * Opportunities and the sales pipeline. Moving a deal to a stage adopts that
 * stage's win probability; a won deal references its ORDER by opaque id only —
 * Commerce owns the order, the CRM owns the deal.
 */
final class OpportunityService
{
    public function __construct(private readonly PipelineService $pipelines) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, array $data, ?int $actorId = null): Opportunity
    {
        $pipeline = isset($data['pipeline_id'])
            ? Pipeline::query()->where('company_id', $companyId)->where('id', $data['pipeline_id'])->with('stages')->first()
            : $this->pipelines->defaultPipeline($companyId);

        $stage = $pipeline !== null ? $this->pipelines->firstStage($pipeline) : null;

        $created = Opportunity::create([
            'company_id' => $companyId,
            'customer_id' => $data['customer_id'] ?? null,
            'lead_id' => $data['lead_id'] ?? null,
            'pipeline_id' => $pipeline?->id,
            'stage_id' => $stage?->id,
            'name' => $data['name'],
            'amount' => $data['amount'] ?? 0,
            'currency' => $data['currency'] ?? 'EGP',
            'probability' => $stage?->probability ?? 0,
            'expected_close_date' => $data['expected_close_date'] ?? null,
            'status' => OpportunityStatus::Open->value,
            'source' => $data['source'] ?? null,
            'owner_id' => $data['owner_id'] ?? $actorId,
            'created_by' => $actorId,
        ]);

        DB::afterCommit(static fn () => event(new OpportunityCreated(
            companyId: $companyId,
            opportunityId: (string) $created->id,
            customerId: $created->customer_id !== null ? (string) $created->customer_id : null,
            amount: $created->amount !== null ? (float) $created->amount : null,
            currency: (string) ($created->currency ?? 'EGP'),
            actorId: $actorId,
        )));

        return $created;
    }

    public function moveToStage(Opportunity $opportunity, PipelineStage $stage): Opportunity
    {
        $this->assertOpen($opportunity);

        $previousStageId = $opportunity->stage_id !== null ? (string) $opportunity->stage_id : null;

        $opportunity->update(['stage_id' => $stage->id, 'probability' => $stage->probability]);

        // A move into a won or lost stage IS the win or the loss, and win()/lose()
        // publish it. Returning here keeps one transition to one event rather
        // than announcing both a stage change and an outcome.
        if ($stage->is_won) {
            return $this->win($opportunity->refresh());
        }
        if ($stage->is_lost) {
            return $this->lose($opportunity->refresh(), 'Moved to a lost stage');
        }

        $fresh = $opportunity->refresh();

        DB::afterCommit(static fn () => event(new OpportunityUpdated(
            companyId: (string) $fresh->company_id,
            opportunityId: (string) $fresh->id,
            stageId: (string) $stage->id,
            previousStageId: $previousStageId,
        )));

        return $fresh;
    }

    public function win(Opportunity $opportunity, ?string $orderReference = null, ?int $actorId = null): Opportunity
    {
        $this->assertOpen($opportunity);

        $opportunity->update([
            'status' => OpportunityStatus::Won->value,
            'probability' => 100,
            'won_at' => Carbon::now(),
            'order_reference' => $orderReference,
        ]);

        $fresh = $opportunity->refresh();

        DB::afterCommit(static fn () => event(new OpportunityWon(
            companyId: (string) $fresh->company_id,
            opportunityId: (string) $fresh->id,
            customerId: $fresh->customer_id !== null ? (string) $fresh->customer_id : null,
            amount: $fresh->amount !== null ? (float) $fresh->amount : null,
            currency: (string) ($fresh->currency ?? 'EGP'),
            actorId: $actorId,
        )));

        return $fresh;
    }

    public function lose(Opportunity $opportunity, string $reason, ?int $actorId = null): Opportunity
    {
        $this->assertOpen($opportunity);

        $opportunity->update([
            'status' => OpportunityStatus::Lost->value,
            'probability' => 0,
            'lost_at' => Carbon::now(),
            'lost_reason' => $reason,
        ]);

        $fresh = $opportunity->refresh();

        DB::afterCommit(static fn () => event(new OpportunityLost(
            companyId: (string) $fresh->company_id,
            opportunityId: (string) $fresh->id,
            customerId: $fresh->customer_id !== null ? (string) $fresh->customer_id : null,
            reason: $reason,
            actorId: $actorId,
        )));

        return $fresh;
    }

    public function reopen(Opportunity $opportunity): Opportunity
    {
        $opportunity->update([
            'status' => OpportunityStatus::Open->value,
            'won_at' => null, 'lost_at' => null, 'lost_reason' => null, 'order_reference' => null,
        ]);

        return $opportunity->refresh();
    }

    /**
     * The weighted pipeline forecast — open deals summed by amount × probability.
     *
     * @return array<string, mixed>
     */
    public function forecast(string $companyId): array
    {
        $open = Opportunity::query()->where('company_id', $companyId)->where('status', 'open')->get();

        return [
            'open_count' => $open->count(),
            'total_value' => round((float) $open->sum('amount'), 2),
            'weighted_value' => round($open->sum(fn (Opportunity $o) => $o->weightedValue()), 2),
        ];
    }

    private function assertOpen(Opportunity $opportunity): void
    {
        if ($opportunity->status->isClosed()) {
            throw SalesException::opportunityClosed($opportunity->name);
        }
    }
}
