<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // config_delivery_geographies: add master_governorate_id FK
        DB::statement('ALTER TABLE config_delivery_geographies ADD COLUMN master_governorate_id CHAR(36) NULL AFTER id');
        DB::statement('ALTER TABLE config_delivery_geographies ADD INDEX idx_cdg_master_gov (master_governorate_id)');
        DB::statement('ALTER TABLE config_delivery_geographies ADD CONSTRAINT fk_cdg_master_gov FOREIGN KEY (master_governorate_id) REFERENCES master_governorates(id) ON DELETE SET NULL');

        // config_delivery_zones: add master_zone_id FK + custom_shipping_cost
        DB::statement('ALTER TABLE config_delivery_zones ADD COLUMN master_zone_id CHAR(36) NULL AFTER id');
        DB::statement('ALTER TABLE config_delivery_zones ADD COLUMN custom_shipping_cost DECIMAL(10,2) NULL AFTER is_active');
        DB::statement('ALTER TABLE config_delivery_zones ADD INDEX idx_cdz_master_zone (master_zone_id)');
        DB::statement('ALTER TABLE config_delivery_zones ADD CONSTRAINT fk_cdz_master_zone FOREIGN KEY (master_zone_id) REFERENCES master_zones(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE config_delivery_geographies DROP FOREIGN KEY fk_cdg_master_gov');
        DB::statement('ALTER TABLE config_delivery_geographies DROP INDEX idx_cdg_master_gov');
        DB::statement('ALTER TABLE config_delivery_geographies DROP COLUMN master_governorate_id');

        DB::statement('ALTER TABLE config_delivery_zones DROP FOREIGN KEY fk_cdz_master_zone');
        DB::statement('ALTER TABLE config_delivery_zones DROP INDEX idx_cdz_master_zone');
        DB::statement('ALTER TABLE config_delivery_zones DROP COLUMN master_zone_id');
        DB::statement('ALTER TABLE config_delivery_zones DROP COLUMN custom_shipping_cost');
    }
};
