<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

class RootCauseClassifier
{
    private array $patterns = [
        'build_failure' => [
            'syntax_error'        => ['syntax error', 'parse error'],
            'missing_dependency'  => ['class not found', 'undefined function', 'module not found'],
            'type_mismatch'       => ['type error', 'incompatible type'],
            'compilation_error'   => ['build error', 'failed to compile'],
        ],
        'test_failure' => [
            'assertion_failure'   => ['assertion failed', 'expected', 'actual'],
            'missing_fixture'     => ['no such table', 'relation does not exist', 'factory not found'],
            'environment_mismatch'=> ['connection refused', 'could not connect'],
            'logic_error'         => ['wrong output'],
        ],
        'validation_failure' => [
            'missing_required_field'    => ['required', 'cannot be null'],
            'invalid_format'            => ['invalid format', 'does not match'],
            'out_of_range'              => ['out of range', 'too long', 'max length'],
            'business_rule_violation'   => ['violation', 'constraint', 'policy'],
        ],
        'security_issue' => [
            'sql_injection'        => ['sql injection', 'unsanitized input', 'raw query'],
            'xss_vulnerability'    => ['xss', 'cross-site scripting'],
            'auth_bypass'          => ['authentication bypass', 'unauthorized access'],
            'exposed_credentials'  => ['hardcoded secret', 'api key in code'],
        ],
        'architecture_violation' => [
            'circular_dependency' => ['circular dependency', 'circular reference'],
            'layer_violation'     => ['layer boundary', 'infrastructure in domain'],
            'adr_violation'       => ['adr', 'architectural decision'],
            'coupling_issue'      => ['tight coupling', 'violates ddd'],
        ],
    ];

    public function classify(string $failureType, array $context): string
    {
        $combined = strtolower(implode(' ', array_filter([
            $context['error_message'] ?? '',
            $context['stack_trace']   ?? '',
            $context['log_output']    ?? '',
            $context['summary']       ?? '',
        ])));

        $typePatterns = $this->patterns[$failureType] ?? [];

        foreach ($typePatterns as $rootCause => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($combined, $keyword)) {
                    return $rootCause;
                }
            }
        }

        return $failureType . '_general';
    }

    public function describeRootCause(string $failureType, string $rootCause, array $context): string
    {
        return match ($rootCause) {
            'syntax_error'
                => 'A syntax or parse error was detected in the source code. Review the indicated file for malformed statements, missing brackets, or invalid language constructs.',

            'missing_dependency'
                => 'A required class, function, or module could not be resolved. Verify that all dependencies are installed, autoloaded, and correctly namespaced.',

            'type_mismatch'
                => 'A type incompatibility was encountered. Ensure method signatures, return types, and argument types are consistent across the call chain.',

            'assertion_failure'
                => 'A test assertion did not produce the expected value. Inspect the test expectations and the underlying business logic to identify the divergence.',

            'missing_fixture'
                => 'A required database table, relation, or factory is absent. Run pending migrations and ensure all test factories are registered before executing the suite.',

            'sql_injection'
                => 'A potential SQL injection vulnerability was identified. Replace raw query interpolation with parameterised bindings or query-builder methods.',

            'circular_dependency'
                => 'A circular dependency or circular reference was detected between components. Restructure the dependency graph to break the cycle, introducing abstractions or mediators as needed.',

            'layer_violation'
                => 'An infrastructure concern has leaked into the domain layer. Move the offending code to the appropriate infrastructure or application layer to restore boundary integrity.',

            'adr_violation'
                => 'The change conflicts with an approved Architectural Decision Record. Review the relevant ADR and align the implementation with the documented decision.',

            default
                => 'Failure in ' . $failureType . ': ' . ($context['summary'] ?? 'see failure context for details'),
        };
    }
}
