<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_ai_metrics')) { return; }
        Schema::create('engineering_ai_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->string('metric_type');
            $table->string('metric_key');
            $table->decimal('metric_value', 10, 4)->default(0);
            $table->json('dimensions')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->index(['company_id', 'metric_type', 'metric_key']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_metrics'); }
};
