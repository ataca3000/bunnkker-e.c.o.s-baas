<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timeline_events', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->string('company_id', 36)->index();
            $table->string('subject_type', 100)->index();
            $table->string('subject_id', 36)->index();
            $table->string('event_type', 100)->index();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name', 150)->nullable();
            $table->string('actor_type', 50)->default('user');
            $table->json('metadata')->nullable();
            $table->string('source_module', 100)->nullable();
            $table->string('correlation_id', 36)->nullable()->index();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['subject_type', 'subject_id'], 'idx_timeline_subject');
            $table->index(['company_id', 'occurred_at'], 'idx_timeline_company_time');
            $table->index(['event_type', 'occurred_at'], 'idx_timeline_type_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timeline_events');
    }
};
