<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_ai_architecture_checks')) { return; }
        Schema::create('engineering_ai_architecture_checks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('review_id')->index();
            $table->string('adr_reference');   // ADR-020, ADR-021, etc.
            $table->string('check_name');
            $table->text('check_description');
            $table->boolean('passed')->default(false);
            $table->string('severity')->nullable(); // critical, high, medium, low, info
            $table->text('details')->nullable();
            $table->json('evidence')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['review_id', 'adr_reference']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_architecture_checks'); }
};
