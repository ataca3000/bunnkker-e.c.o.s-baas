<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_guardian_decisions')) {
            return;
        }

        Schema::create('engineering_guardian_decisions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('run_id');
            $table->uuid('company_id');
            $table->string('decision'); // allow|block
            $table->text('reason');
            $table->string('decided_by')->default('system'); // system or a user uuid string
            $table->json('policy_snapshot')->nullable();
            $table->timestamp('occurred_at');

            $table->index('run_id');
            $table->index('company_id');
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_guardian_decisions');
    }
};
