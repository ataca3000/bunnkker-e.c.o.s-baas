<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_reports')) { return; }
        Schema::create('engineering_release_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('report_type');
            $table->string('title');
            $table->longText('content');
            $table->json('structured_data')->nullable();
            $table->string('format')->default('markdown');
            $table->string('generated_by')->default('system');
            $table->timestamp('generated_at')->nullable();
            $table->boolean('is_final')->default(false);
            $table->integer('version')->default(1);
            $table->softDeletes();
            $table->timestamps();
            $table->index(['release_id', 'report_type']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_reports'); }
};
