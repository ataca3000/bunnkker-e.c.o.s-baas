<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add code + lifecycle flags
        DB::statement('ALTER TABLE master_zones
            ADD COLUMN code        VARCHAR(20)  NULL UNIQUE AFTER name,
            ADD COLUMN is_active   TINYINT(1)   NOT NULL DEFAULT 1 AFTER sort_order,
            ADD COLUMN is_archived TINYINT(1)   NOT NULL DEFAULT 0 AFTER is_active
        ');

        // Add zone metadata columns
        DB::statement("ALTER TABLE master_zones
            ADD COLUMN estimated_delivery_sla_hours TINYINT UNSIGNED NULL,
            ADD COLUMN default_warehouse_id         CHAR(36)         NULL,
            ADD COLUMN default_logistics_hub        VARCHAR(100)     NULL,
            ADD COLUMN delivery_difficulty          ENUM('easy','medium','hard') NULL,
            ADD COLUMN priority                     TINYINT UNSIGNED NULL DEFAULT 5,
            ADD COLUMN latitude                     DECIMAL(10,7)    NULL,
            ADD COLUMN longitude                    DECIMAL(10,7)    NULL,
            ADD COLUMN polygon_id                   VARCHAR(100)     NULL,
            ADD COLUMN notes                        TEXT             NULL
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE master_zones
            DROP COLUMN notes,
            DROP COLUMN polygon_id,
            DROP COLUMN longitude,
            DROP COLUMN latitude,
            DROP COLUMN priority,
            DROP COLUMN delivery_difficulty,
            DROP COLUMN default_logistics_hub,
            DROP COLUMN default_warehouse_id,
            DROP COLUMN estimated_delivery_sla_hours,
            DROP COLUMN is_archived,
            DROP COLUMN is_active,
            DROP COLUMN code
        ');
    }
};
