<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_ai_security_checks')) { return; }
        Schema::create('engineering_ai_security_checks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('review_id')->index();
            $table->string('check_name');
            $table->string('category'); // authentication, authorization, injection, secrets, permissions, input_validation, output_encoding, audit_trail, encryption, sensitive_data
            $table->boolean('passed')->default(false);
            $table->string('severity')->nullable();
            $table->text('details')->nullable();
            $table->text('remediation')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_security_checks'); }
};
