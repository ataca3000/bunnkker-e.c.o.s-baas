<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_zone_plans')) {
            return;
        }

        Schema::create('distribution_zone_plans', function (Blueprint $table): void {
            $table->id();
            $table->date('planning_date');
            $table->foreignId('zone_id')
                ->constrained('distribution_zones')
                ->cascadeOnDelete();
            $table->enum('status', ['ready', 'in_planning', 'planned'])->default('ready');
            $table->text('notes')->nullable();
            $table->string('planned_by')->nullable();
            $table->timestamp('planned_at')->nullable();
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['planning_date', 'zone_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_zone_plans');
    }
};
