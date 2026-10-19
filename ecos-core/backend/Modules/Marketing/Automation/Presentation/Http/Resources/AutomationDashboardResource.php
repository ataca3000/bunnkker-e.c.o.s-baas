<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AutomationDashboardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
