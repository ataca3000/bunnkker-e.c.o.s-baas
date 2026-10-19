<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enforce that one order_id can only appear in ONE wave per company.
        // Existing per-wave uniqueness (preparation_wave_id, order_id) is preserved.
        // Verify no violations before adding — safe on fresh/seeded dev databases.
        DB::statement(
            'ALTER TABLE preparation_wave_orders '
            .'ADD CONSTRAINT uq_prep_wave_orders_company_order UNIQUE (company_id, order_id)',
        );
    }

    public function down(): void
    {
        DB::statement(
            'ALTER TABLE preparation_wave_orders '
            .'DROP INDEX uq_prep_wave_orders_company_order',
        );
    }
};
