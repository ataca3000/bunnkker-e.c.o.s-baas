<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            ALTER TABLE preparation_wave_orders
            ADD COLUMN payment_status_snapshot VARCHAR(50) NULL AFTER is_paid
        ');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE preparation_wave_orders DROP COLUMN payment_status_snapshot');
    }
};
