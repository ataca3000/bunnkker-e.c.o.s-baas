<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\Process;
use Modules\System\Engineering\Domain\Enums\ValidatorType;
use Throwable;

/**
 * Executes toolchain validators as OS processes for the Self-Healing
 * Pipeline (TASK-ENG-V2-002).
 *
 * Uses the Laravel Process facade so tests can Process::fake().
 *
 * A validator with no configured command is a FAILURE, never a silent
 * pass — the never-bypass rule. Applicability must be decided upstream
 * (PatchValidatorRegistry / ValidatorType::appliesTo()); the zero-file
 * short-circuit here is only a safety net.
 */
final class CommandValidatorRunner
{
    /**
     * Run a validator command against the patch file set.
     *
     * @param  array<int, string>  $files
     * @return array{passed: bool, exit_code: ?int, output: string, error_output: string, duration_ms: int, error: ?string}
     */
    public function run(ValidatorType $type, array $files): array
    {
        $command = config('engineering.self_healing.commands.' . $type->value);

        if (! is_array($command) || $command === []) {
            return [
                'passed'       => false,
                'exit_code'    => null,
                'output'       => '',
                'error_output' => '',
                'duration_ms'  => 0,
                'error'        => 'Validator command not configured: ' . $type->value,
            ];
        }

        $timeout = $type->defaultTimeoutSeconds();
        $workdir = (string) config('engineering.self_healing.working_directory', base_path());

        $startedAt = microtime(true);

        try {
            if ($type === ValidatorType::PhpSyntax) {
                return $this->runPhpSyntax($command, $files, $timeout, $workdir, $startedAt);
            }

            if ($type === ValidatorType::Eslint) {
                $command = array_merge($command, array_values(array_filter(
                    $files,
                    static fn (string $file): bool => str_ends_with($file, '.ts') || str_ends_with($file, '.tsx')
                )));
            }

            $result = $this->runSingle($command, $timeout, $workdir);

            return [
                'passed'       => $result->exitCode() === 0,
                'exit_code'    => $result->exitCode(),
                'output'       => $result->output(),
                'error_output' => $result->errorOutput(),
                'duration_ms'  => $this->elapsedMs($startedAt),
                'error'        => null,
            ];
        } catch (Throwable $exception) {
            return [
                'passed'       => false,
                'exit_code'    => null,
                'output'       => '',
                'error_output' => '',
                'duration_ms'  => $this->elapsedMs($startedAt),
                'error'        => $exception->getMessage(),
            ];
        }
    }

    /**
     * php_syntax runs once per .php file (php -l FILE); all must pass.
     *
     * @param  array<int, string>  $command
     * @param  array<int, string>  $files
     * @return array{passed: bool, exit_code: ?int, output: string, error_output: string, duration_ms: int, error: ?string}
     */
    private function runPhpSyntax(array $command, array $files, int $timeout, string $workdir, float $startedAt): array
    {
        $phpFiles = array_values(array_filter(
            $files,
            static fn (string $file): bool => str_ends_with($file, '.php')
        ));

        if ($phpFiles === []) {
            // Applicability should have been checked upstream; this is a safety net.
            return [
                'passed'       => true,
                'exit_code'    => 0,
                'output'       => 'no applicable files',
                'error_output' => '',
                'duration_ms'  => $this->elapsedMs($startedAt),
                'error'        => null,
            ];
        }

        $passed = true;
        $lastExitCode = 0;
        $outputs = [];
        $errorOutputs = [];

        foreach ($phpFiles as $file) {
            $result = $this->runSingle(array_merge($command, [$file]), $timeout, $workdir);

            $exitCode = $result->exitCode();
            $lastExitCode = $exitCode;

            if ($exitCode !== 0) {
                $passed = false;
            }

            if ($result->output() !== '') {
                $outputs[] = trim($result->output());
            }

            if ($result->errorOutput() !== '') {
                $errorOutputs[] = trim($result->errorOutput());
            }
        }

        return [
            'passed'       => $passed,
            'exit_code'    => $passed ? 0 : $lastExitCode,
            'output'       => implode("\n", $outputs),
            'error_output' => implode("\n", $errorOutputs),
            'duration_ms'  => $this->elapsedMs($startedAt),
            'error'        => null,
        ];
    }

    /**
     * Execute a single command through the Process facade.
     *
     * @param  array<int, string>  $command
     */
    private function runSingle(array $command, int $timeout, string $workdir): object
    {
        return Process::timeout($timeout)
            ->path($workdir)
            ->run($command);
    }

    private function elapsedMs(float $startedAt): int
    {
        return (int) round((microtime(true) - $startedAt) * 1000);
    }
}
