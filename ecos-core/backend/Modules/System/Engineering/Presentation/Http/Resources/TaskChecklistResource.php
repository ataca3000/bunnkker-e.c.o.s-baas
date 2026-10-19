<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskChecklistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->items ?? collect();

        $total     = $items->count();
        $completed = $items->filter(fn ($item) => $item->is_completed)->count();
        $percent   = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        return [
            'id'      => $this->id,
            'task_id' => $this->task_id,
            'title'   => $this->title,
            'position' => $this->position,

            'items' => $items->map(fn ($item) => [
                'id'           => $item->id,
                'content'      => $item->content,
                'is_completed' => $item->is_completed,
                'completed_at' => isset($item->completed_at) ? $item->completed_at?->toIsoString() : null,
                'position'     => $item->position,
            ])->values(),

            'progress' => [
                'total'     => $total,
                'completed' => $completed,
                'percent'   => $percent,
            ],

            'created_at' => $this->created_at->toIsoString(),
        ];
    }
}
