<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_ai_scores')) { return; }
        Schema::create('engineering_ai_scores', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('review_id');
            $table->string('dimension'); // architecture, backend, frontend, database, security, testing, documentation, performance, maintainability
            $table->decimal('score', 5, 2)->default(0);
            $table->decimal('weight', 5, 2)->default(0);
            $table->decimal('weighted_score', 5, 2)->default(0);
            $table->json('details')->nullable();
            $table->unsignedInteger('issues_found')->default(0);
            $table->unsignedInteger('passed_checks')->default(0);
            $table->unsignedInteger('failed_checks')->default(0);
            $table->timestamps();
            $table->index('review_id');
            $table->index('dimension');
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_scores'); }
};
