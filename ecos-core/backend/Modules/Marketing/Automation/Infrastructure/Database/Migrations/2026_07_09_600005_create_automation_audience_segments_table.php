<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_audience_segments')) {
            return;
        }

        Schema::create('automation_audience_segments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('segment_type', 30)->index();
            $table->json('rules');
            $table->string('entity_type', 50)->default('customer');
            $table->unsignedBigInteger('member_count')->default(0);
            $table->boolean('is_dynamic')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_calculated_at')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('automation_segment_memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('segment_id')->index();
            $table->string('entity_type', 50);
            $table->string('entity_id', 36);
            $table->boolean('is_active')->default(true);
            $table->timestamp('added_at')->useCurrent();
            $table->timestamp('removed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['segment_id', 'entity_type', 'entity_id'], 'auto_seg_mbr_unique');
        });

        DB::statement('CREATE INDEX auto_seg_member_entity_idx ON automation_segment_memberships (entity_type, entity_id, is_active)');
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_segment_memberships');
        Schema::dropIfExists('automation_audience_segments');
    }
};
