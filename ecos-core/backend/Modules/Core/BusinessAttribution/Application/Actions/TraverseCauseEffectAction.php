<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Modules\Core\BusinessAttribution\Application\Services\RootCauseTraversalService;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\CauseEffectChain;

class TraverseCauseEffectAction
{
    public function __construct(
        private readonly RootCauseTraversalService $traversal,
    ) {}

    /**
     * @param  string  $direction  'both' | 'up' (causes only) | 'down' (effects only)
     */
    public function execute(
        string $eventId,
        string $direction = 'both',
        int $maxDepth = 10,
    ): CauseEffectChain {
        $full = $this->traversal->traverseFromEvent($eventId, $maxDepth);

        if ($direction === 'up') {
            $nodes = array_values(array_filter(
                $full->nodes,
                static fn (array $n): bool => in_array($n['relation'], ['self', 'cause'], true),
            ));

            return new CauseEffectChain($eventId, $nodes, $maxDepth, count($nodes));
        }

        if ($direction === 'down') {
            $nodes = array_values(array_filter(
                $full->nodes,
                static fn (array $n): bool => in_array($n['relation'], ['self', 'effect'], true),
            ));

            return new CauseEffectChain($eventId, $nodes, $maxDepth, count($nodes));
        }

        return $full;
    }
}
