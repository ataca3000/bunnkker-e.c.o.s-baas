<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Promotes the minimal registry created by TASK-LOG-002 into the full fleet
 * aggregate owned by TASK-LOG-003.
 *
 * The table is EXTENDED rather than replaced, exactly as flagged in the
 * TASK-LOG-002 engineering report, so the driver↔vehicle assignment ledger and
 * its foreign keys survive untouched.
 *
 * Status vocabulary widens from active|inactive|archived to the six-state fleet
 * lifecycle. Existing rows are mapped: active → available, inactive →
 * out_of_service, archived → archived.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('logistics_vehicles')) {
            return;
        }

        Schema::table('logistics_vehicles', function (Blueprint $table) {
            if (! Schema::hasColumn('logistics_vehicles', 'uuid')) {
                // UUID-ready: external systems and future modules reference the
                // stable uuid while existing bigint foreign keys keep working.
                $table->uuid('uuid')->nullable()->after('id');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'vehicle_code')) {
                $table->string('vehicle_code', 30)->nullable()->after('uuid');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'name')) {
                $table->string('name', 150)->nullable()->after('plate_number');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'company_id')) {
                $table->uuid('company_id')->nullable()->after('shipping_company_id');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'branch_id')) {
                $table->uuid('branch_id')->nullable()->after('company_id');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'capacity_weight_kg')) {
                $table->decimal('capacity_weight_kg', 10, 2)->nullable()->after('capacity_orders');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'capacity_volume_m3')) {
                $table->decimal('capacity_volume_m3', 10, 3)->nullable()->after('capacity_weight_kg');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'fuel_type')) {
                $table->string('fuel_type', 20)->nullable()->after('capacity_volume_m3');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'manufacturer')) {
                $table->string('manufacturer', 80)->nullable()->after('fuel_type');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'color')) {
                $table->string('color', 40)->nullable()->after('year');
            }
            if (! Schema::hasColumn('logistics_vehicles', 'vin')) {
                $table->string('vin', 40)->nullable()->after('color');
            }
        });

        // Carry the legacy `make` values into `manufacturer` before it retires.
        if (Schema::hasColumn('logistics_vehicles', 'make')) {
            DB::table('logistics_vehicles')
                ->whereNull('manufacturer')
                ->whereNotNull('make')
                ->update(['manufacturer' => DB::raw('`make`')]);
        }

        // Widen the status vocabulary on existing rows.
        DB::table('logistics_vehicles')->where('status', 'active')->update(['status' => 'available']);
        DB::table('logistics_vehicles')->where('status', 'inactive')->update(['status' => 'out_of_service']);

        // Move the column default off the retired 'active' value, otherwise a
        // raw insert would write a status the VehicleStatus cast cannot resolve.
        DB::statement("ALTER TABLE `logistics_vehicles` MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'available'");

        // Backfill identity for any pre-existing row, then lock both in.
        $rows = DB::table('logistics_vehicles')
            ->select('id', 'uuid', 'vehicle_code', 'name', 'plate_number')
            ->get();

        $sequence = 0;
        foreach ($rows as $row) {
            $updates = [];
            if ($row->uuid === null) {
                $updates['uuid'] = (string) Str::uuid();
            }
            if ($row->vehicle_code === null) {
                $updates['vehicle_code'] = sprintf('VEH-%03d', ++$sequence);
            }
            if ($row->name === null) {
                $updates['name'] = $row->plate_number;
            }
            if ($updates !== []) {
                DB::table('logistics_vehicles')->where('id', $row->id)->update($updates);
            }
        }

        Schema::table('logistics_vehicles', function (Blueprint $table) {
            $table->unique('vehicle_code', 'logistics_vehicles_vehicle_code_unique');
            $table->unique('uuid', 'logistics_vehicles_uuid_unique');
            $table->index(['company_id', 'branch_id'], 'logistics_vehicles_org_index');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('logistics_vehicles')) {
            return;
        }

        Schema::table('logistics_vehicles', function (Blueprint $table) {
            $table->dropUnique('logistics_vehicles_vehicle_code_unique');
            $table->dropUnique('logistics_vehicles_uuid_unique');
            $table->dropIndex('logistics_vehicles_org_index');
            $table->dropColumn([
                'uuid', 'vehicle_code', 'name', 'company_id', 'branch_id',
                'capacity_weight_kg', 'capacity_volume_m3', 'fuel_type',
                'manufacturer', 'color', 'vin',
            ]);
        });

        DB::statement("ALTER TABLE `logistics_vehicles` MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'active'");
        DB::table('logistics_vehicles')->where('status', 'available')->update(['status' => 'active']);
        DB::table('logistics_vehicles')->where('status', 'out_of_service')->update(['status' => 'inactive']);
    }
};
