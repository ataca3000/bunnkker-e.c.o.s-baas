<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_metrics')) { return; }
        Schema::create('engineering_release_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('metric_type');
            $table->string('metric_key');
            $table->float('value')->default(0);
            $table->string('unit')->nullable();
            $table->json('breakdown')->nullable();
            $table->timestamp('recorded_at');
            $table->index(['release_id', 'metric_type']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_metrics'); }
};
