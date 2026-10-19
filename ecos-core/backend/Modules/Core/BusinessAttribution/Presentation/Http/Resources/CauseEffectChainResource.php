<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\CauseEffectChain;

class CauseEffectChainResource extends JsonResource
{
    public function __construct(private readonly CauseEffectChain $chain) {}

    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'data' => [
                'root_event_id' => $this->chain->rootEventId,
                'total_nodes' => $this->chain->totalNodes,
                'max_depth' => $this->chain->maxDepth,
                'causes' => $this->chain->getCauses(),
                'effects' => $this->chain->getEffects(),
                'nodes' => $this->chain->nodes,
                'critical_path' => $this->chain->criticalPath,
            ],
        ];
    }
}
