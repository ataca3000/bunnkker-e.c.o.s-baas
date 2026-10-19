<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Exceptions\OperationsException;
use Modules\Logistics\Operations\Domain\Models\AlertRule;
use Modules\Logistics\Operations\Domain\Models\ExceptionEscalation;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * Moving a problem up the chain when nobody has picked it up.
 *
 * Escalation is capped. An unbounded ladder means an exception can be escalated
 * indefinitely by someone who does not want to own it, and the top of the chain
 * learns to ignore the channel.
 */
class ExceptionEscalationService
{
    /** Beyond this, escalating again says nothing new. */
    public const MAX_LEVEL = 3;

    /**
     * Escalate by hand.
     *
     * The reason is mandatory: handing someone a problem with no context is
     * precisely how escalations stall at the next desk.
     */
    public function escalate(
        OperationalException $exception,
        string $reason,
        ?string $toRole = null,
        ?int $toUserId = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): ExceptionEscalation {
        if (trim($reason) === '') {
            throw OperationsException::escalationReasonRequired();
        }

        return $this->raise(
            $exception,
            trim($reason),
            ExceptionEscalation::TRIGGER_MANUAL,
            $toRole,
            $toUserId,
            $actorId,
            $actorName,
        );
    }

    /**
     * Escalate everything that has waited too long.
     *
     * The threshold comes from the matching alert rule, or from the severity's
     * own default when no rule matches. Info-level exceptions never qualify:
     * escalating trivia is how an escalation channel becomes noise.
     *
     * @return list<ExceptionEscalation>
     */
    public function escalateOverdue(?string $companyId = null, ?Carbon $at = null): array
    {
        $at ??= Carbon::now();

        $rules = AlertRule::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('is_active', true)
            ->get();

        $candidates = OperationalException::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [ExceptionStatus::Open->value, ExceptionStatus::Escalated->value])
            ->whereNull('acknowledged_at')
            ->where('escalation_level', '<', self::MAX_LEVEL)
            ->get();

        $raised = [];

        foreach ($candidates as $exception) {
            $rule = $rules->first(fn (AlertRule $r) => $r->matches($exception));

            // A suppressing rule means someone deliberately silenced this class
            // of problem. Escalating it anyway would defeat the decision.
            if ($rule?->suppress === true) {
                continue;
            }

            $threshold = $rule?->escalationMinutesFor($exception)
                ?? $exception->severity->defaultEscalationMinutes();

            if ($threshold === null) {
                continue;
            }

            $waiting = $exception->unacknowledgedMinutes($at);

            if ($waiting === null || $waiting < $threshold) {
                continue;
            }

            $raised[] = $this->raise(
                $exception,
                "Unacknowledged for {$waiting} minutes (threshold {$threshold}).",
                ExceptionEscalation::TRIGGER_TIMEOUT,
                $rule?->escalate_to_role,
            );
        }

        return $raised;
    }

    /** Someone at the escalated level has taken it. */
    public function acknowledgeEscalation(
        ExceptionEscalation $escalation,
        ?int $actorId = null,
    ): ExceptionEscalation {
        if ($escalation->acknowledged_at !== null) {
            return $escalation;
        }

        $escalation->update([
            'acknowledged_at' => Carbon::now(),
            'acknowledged_by' => $actorId,
        ]);

        return $escalation->refresh();
    }

    /** @return list<ExceptionEscalation> */
    public function historyFor(OperationalException $exception): array
    {
        return $exception->escalations()
            ->orderBy('level')
            ->orderBy('escalated_at')
            ->get()
            ->all();
    }

    private function raise(
        OperationalException $exception,
        string $reason,
        string $trigger,
        ?string $toRole = null,
        ?int $toUserId = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): ExceptionEscalation {
        if ($exception->escalation_level >= self::MAX_LEVEL) {
            throw OperationsException::alreadyAtTopEscalation($exception->escalation_level);
        }

        return DB::transaction(function () use (
            $exception, $reason, $trigger, $toRole, $toUserId, $actorId, $actorName
        ) {
            $level = $exception->escalation_level + 1;

            $escalation = ExceptionEscalation::create([
                'company_id' => $exception->company_id,
                'exception_id' => $exception->id,
                'level' => $level,
                'escalated_to_role' => $toRole,
                'escalated_to_user_id' => $toUserId,
                'reason' => $reason,
                'trigger' => $trigger,
                'escalated_at' => Carbon::now(),
                'escalated_by' => $actorId,
                'escalated_by_name' => $actorName,
            ]);

            $updates = ['escalation_level' => $level];

            // An acknowledged exception that gets escalated goes back to
            // needing attention — somebody decided the acknowledgement was not
            // enough.
            if ($exception->status->canTransitionTo(ExceptionStatus::Escalated)) {
                $updates['status'] = ExceptionStatus::Escalated->value;
            }

            $exception->update($updates);

            return $escalation;
        });
    }
}
