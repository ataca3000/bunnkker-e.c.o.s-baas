<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\ValueObjects;

/** Immutable result returned by a CI provider after polling/waiting. */
final class CIResult
{
    private function __construct(
        public readonly bool    $completed,
        public readonly bool    $passed,
        public readonly string  $status,       // queued | in_progress | completed | timed_out
        public readonly ?string $conclusion,   // success | failure | cancelled | skipped | null
        public readonly ?string $runUrl,
        public readonly ?string $runId,
        public readonly ?string $message,
    ) {}

    public static function pending(?string $runId = null, ?string $runUrl = null): self
    {
        return new self(
            completed:  false,
            passed:     false,
            status:     'in_progress',
            conclusion: null,
            runUrl:     $runUrl,
            runId:      $runId,
            message:    null,
        );
    }

    public static function success(?string $runId = null, ?string $runUrl = null): self
    {
        return new self(
            completed:  true,
            passed:     true,
            status:     'completed',
            conclusion: 'success',
            runUrl:     $runUrl,
            runId:      $runId,
            message:    'Workflow succeeded.',
        );
    }

    public static function failure(string $conclusion, ?string $runId = null, ?string $runUrl = null, ?string $message = null): self
    {
        return new self(
            completed:  true,
            passed:     false,
            status:     'completed',
            conclusion: $conclusion,
            runUrl:     $runUrl,
            runId:      $runId,
            message:    $message ?? "Workflow {$conclusion}.",
        );
    }

    public static function timedOut(?string $runId = null, ?string $runUrl = null): self
    {
        return new self(
            completed:  true,
            passed:     false,
            status:     'timed_out',
            conclusion: null,
            runUrl:     $runUrl,
            runId:      $runId,
            message:    'CI wait timed out.',
        );
    }

    public static function unavailable(string $reason): self
    {
        return new self(
            completed:  true,
            passed:     false,
            status:     'unavailable',
            conclusion: null,
            runUrl:     null,
            runId:      null,
            message:    $reason,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'completed'  => $this->completed,
            'passed'     => $this->passed,
            'status'     => $this->status,
            'conclusion' => $this->conclusion,
            'run_url'    => $this->runUrl,
            'run_id'     => $this->runId,
            'message'    => $this->message,
        ];
    }
}
