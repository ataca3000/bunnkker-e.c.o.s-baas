<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_ai_risks')) { return; }
        Schema::create('engineering_ai_risks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('review_id')->index();
            $table->uuid('company_id')->index();
            $table->string('severity'); // critical, high, medium, low, informational
            $table->string('category'); // architecture, security, performance, quality, testing, documentation, database, dependency
            $table->string('title');
            $table->text('description');
            $table->text('impact');
            $table->text('recommendation');
            $table->unsignedInteger('priority')->default(99);
            $table->boolean('is_blocking')->default(false);
            $table->boolean('is_acknowledged')->default(false);
            $table->uuid('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->json('evidence')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['review_id', 'severity']);
            $table->index(['company_id', 'is_blocking']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_risks'); }
};
