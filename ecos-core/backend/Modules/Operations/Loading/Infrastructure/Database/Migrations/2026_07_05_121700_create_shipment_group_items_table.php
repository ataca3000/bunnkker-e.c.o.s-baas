<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('shipment_group_items')) {
            return;
        }

        Schema::create('shipment_group_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('shipment_group_id')->constrained('shipment_groups')->restrictOnDelete();
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('loading_session_id');
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['shipment_group_id', 'vehicle_assignment_id'], 'uq_shipment_group_items_group_assignment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_group_items');
    }
};
