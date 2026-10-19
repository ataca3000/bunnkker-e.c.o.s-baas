<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * @mixin Category
 */
final class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'parent' => $this->whenLoaded('parent', fn () => $this->parent === null ? null : [
                'id' => $this->parent->id,
                'code' => $this->parent->code,
                'name' => $this->parent->name,
            ]),
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'level' => (int) $this->level,
            'sort_order' => (int) $this->sort_order,
            'is_active' => (bool) $this->is_active,
            'category_scope' => $this->category_scope ?? 'product',
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
