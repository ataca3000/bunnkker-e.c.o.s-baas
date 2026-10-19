<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE master_governorates
            ADD COLUMN is_active   TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order,
            ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active
        ');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE master_governorates
            DROP COLUMN is_active,
            DROP COLUMN is_archived
        ');
    }
};
