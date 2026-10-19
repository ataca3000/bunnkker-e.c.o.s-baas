<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_pipeline_runs')) { return; }
        Schema::create('engineering_release_pipeline_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('pipeline_run_id')->nullable()->index();
            $table->string('pipeline_type')->default('release');
            $table->string('status')->default('pending');
            $table->string('trigger_type')->default('manual');
            $table->uuid('triggered_by')->nullable();
            $table->json('pipeline_config')->nullable();
            $table->text('logs')->nullable();
            $table->json('result_payload')->nullable();
            $table->string('environment')->default('production');
            $table->integer('exit_code')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['release_id', 'status']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_pipeline_runs'); }
};
