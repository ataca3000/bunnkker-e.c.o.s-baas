<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A performed inspection. Immutable once submitted.
 *
 * performed_by and approved_by are kept separate because a failed critical item
 * may not be signed off by the person who recorded it — the same
 * separation-of-duties rule LOG-005 applied to POD capture vs. validation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_inspections', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->foreignId('template_id')->nullable()
                ->constrained('fleet_inspection_templates')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            // Snapshot of the template version at performance time.
            $table->unsignedSmallInteger('template_version')->nullable();

            $table->string('status', 20)->default('draft');
            $table->string('kind', 20);          // InspectionKind
            $table->decimal('odometer_km', 12, 1)->nullable();

            $table->timestamp('performed_at')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();

            $table->boolean('has_critical_failure')->default(false);
            $table->unsignedSmallInteger('failed_item_count')->default(0);

            $table->text('notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['fleet_unit_id', 'kind', 'submitted_at'], 'fleet_insp_unit_kind_idx');
            $table->index(['company_id', 'status'], 'fleet_insp_company_status_idx');
        });

        Schema::create('fleet_inspection_results', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('inspection_id')
                ->constrained('fleet_inspections')->cascadeOnDelete();
            $table->foreignId('template_item_id')->nullable()
                ->constrained('fleet_inspection_template_items')->nullOnDelete();

            // Item label and severity are copied here so a historical result is
            // readable even if the template item is later renamed or removed.
            $table->string('item_code', 40);
            $table->string('item_label', 200);
            $table->string('failure_severity', 20)->default('major');

            $table->boolean('passed')->default(true);
            $table->text('comment')->nullable();
            $table->json('photos')->nullable();

            $table->timestamps();

            $table->index(['inspection_id', 'passed'], 'fleet_insp_result_pass_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_inspection_results');
        Schema::dropIfExists('fleet_inspections');
    }
};
