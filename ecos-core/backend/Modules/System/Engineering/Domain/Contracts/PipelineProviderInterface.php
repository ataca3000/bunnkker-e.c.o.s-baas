<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Contracts;

use Modules\System\Engineering\Domain\ValueObjects\CIResult;

interface PipelineProviderInterface
{
    public function name(): string;

    public function supportsCI(): bool;

    /** Poll once and return the current CI status for the given branch. */
    public function checkWorkflowStatus(string $branch): CIResult;

    /** Block (poll in a loop) until workflow completes or times out. */
    public function waitForWorkflow(
        string $branch,
        int $maxWaitSeconds = 600,
        int $pollIntervalSeconds = 30,
        ?callable $onPoll = null,
    ): CIResult;

    /** Return a URL to the most-recent run for the given branch, or null. */
    public function getWorkflowUrl(string $branch): ?string;
}
