<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_audit')) { return; }
        Schema::create('engineering_release_audit', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('event_type');
            $table->uuid('actor_id')->nullable();
            $table->string('actor_name')->nullable();
            $table->string('from_status')->nullable();
            $table->string('to_status')->nullable();
            $table->text('description');
            $table->json('payload')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamp('occurred_at');
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_audit'); }
};
