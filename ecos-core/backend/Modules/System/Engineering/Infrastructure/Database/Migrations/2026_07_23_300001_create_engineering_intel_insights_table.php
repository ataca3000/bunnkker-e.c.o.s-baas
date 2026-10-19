<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_intel_insights')) {
            return;
        }

        Schema::create('engineering_intel_insights', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('insight_type');
            $table->string('severity')->default('info');
            $table->string('title');
            $table->text('description');
            $table->json('evidence')->nullable();
            $table->boolean('is_acknowledged')->default(false);
            $table->uuid('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('generated_at');
            $table->timestamps();

            $table->index(['company_id', 'insight_type']);
            $table->index(['company_id', 'is_acknowledged']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_intel_insights');
    }
};
