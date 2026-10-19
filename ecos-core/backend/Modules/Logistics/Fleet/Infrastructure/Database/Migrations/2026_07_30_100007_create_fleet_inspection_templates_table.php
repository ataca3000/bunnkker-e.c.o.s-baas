<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Versioned checklist per fleet group.
 *
 * A submitted inspection records the template VERSION it was performed against,
 * so a two-year-old inspection can still be read exactly as performed. Editing
 * a template creates a new version rather than mutating the old one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_inspection_templates', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_group_id')->nullable()
                ->constrained('fleet_groups')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->string('kind', 20);          // InspectionKind
            $table->unsignedSmallInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);

            $table->timestamps();

            // One live version per (group, code) — nullable-flag emulation of a
            // partial unique index, MySQL-compatible.
            $table->unique(['fleet_group_id', 'code', 'active_flag'], 'fleet_tpl_one_live_unique');
            $table->index(['company_id', 'kind'], 'fleet_tpl_company_kind_idx');
        });

        Schema::create('fleet_inspection_template_items', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('template_id')
                ->constrained('fleet_inspection_templates')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('label', 200);
            $table->text('guidance')->nullable();
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('is_mandatory')->default(true);
            $table->boolean('requires_photo_on_fail')->default(false);

            // The severity a failure of THIS item produces. Putting it on the
            // item is what lets a checklist decide consequence rather than the
            // readiness service guessing.
            $table->string('failure_severity', 20)->default('major');

            $table->timestamps();

            $table->unique(['template_id', 'code'], 'fleet_tpl_item_code_unique');
            $table->index(['template_id', 'display_order'], 'fleet_tpl_item_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_inspection_template_items');
        Schema::dropIfExists('fleet_inspection_templates');
    }
};
