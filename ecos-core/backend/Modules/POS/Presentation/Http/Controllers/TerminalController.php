<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Terminal\Domain\Enums\TerminalStatus;
use Modules\POS\Terminal\Domain\Models\Terminal;

final class TerminalController extends Controller
{
    use HasApiResponse;

    /**
     * Return all Active terminals, ordered by terminal code.
     *
     * GET /api/pos/terminals
     * Response: [{ id, code, name }]
     */
    public function index(): JsonResponse
    {
        $terminals = Terminal::where('status', TerminalStatus::Active->value)
            ->orderBy('terminal_code')
            ->get()
            ->map(static fn (Terminal $t) => [
                'id' => (string) $t->id,
                'code' => $t->terminal_code,
                'name' => $t->name,
            ]);

        return $this->success($terminals);
    }
}
