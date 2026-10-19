<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class AdminDashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $row = DB::selectOne('
            SELECT
                (SELECT COUNT(*) FROM companies         WHERE deleted_at IS NULL) AS companies,
                (SELECT COUNT(*) FROM brands            WHERE deleted_at IS NULL) AS brands,
                (SELECT COUNT(*) FROM business_accounts WHERE deleted_at IS NULL) AS business_accounts,
                (SELECT COUNT(*) FROM channels          WHERE deleted_at IS NULL) AS channels,
                (SELECT COUNT(*) FROM warehouses        WHERE deleted_at IS NULL) AS warehouses,
                (SELECT COUNT(*) FROM teams             WHERE deleted_at IS NULL) AS teams,
                (SELECT COUNT(*) FROM users)                                      AS users
        ');

        return response()->json([
            'data' => [
                'companies' => (int) ($row?->companies ?? 0),
                'brands' => (int) ($row?->brands ?? 0),
                'business_accounts' => (int) ($row?->business_accounts ?? 0),
                'channels' => (int) ($row?->channels ?? 0),
                'warehouses' => (int) ($row?->warehouses ?? 0),
                'teams' => (int) ($row?->teams ?? 0),
                'users' => (int) ($row?->users ?? 0),
                'pending_invitations' => 0,
            ],
        ]);
    }
}
