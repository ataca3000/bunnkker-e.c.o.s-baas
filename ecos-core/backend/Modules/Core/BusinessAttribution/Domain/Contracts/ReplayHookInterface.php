<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayContext;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayResult;

/**
 * Extension point: plug custom logic into the replay lifecycle.
 * Implementations are registered on EnhancedReplayService::registerHook().
 */
interface ReplayHookInterface
{
    /** Called once before replay events are fetched. */
    public function beforeReplay(ReplayContext $context): void;

    /** Called once after all events have been processed. */
    public function afterReplay(ReplayResult $result): void;

    /**
     * Called for each event during replay.
     * May inspect or annotate the state; must return the (possibly modified) state.
     */
    public function onEvent(BusinessEvent $event, array $state): array;
}
