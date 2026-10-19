<?php

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\RepairResponseType;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\RepairPrompt;
use Modules\System\Engineering\Domain\Models\RepairResponse;
use Modules\System\Engineering\Domain\Models\RepairSession;

/**
 * Prepares prompt packages for external delivery to Claude Code.
 *
 * This service does NOT invoke Claude autonomously.
 * It formats and packages repair prompts so they can be delivered
 * and their responses received through an external integration layer.
 */
class ClaudeCodeIntegration
{
    public function prepareClaudePackage(RepairSession $session, RepairPrompt $prompt): array
    {
        return [
            'session_id'       => $session->id,
            'prompt_id'        => $prompt->id,
            'prompt_version'   => $prompt->prompt_version,
            'formatted_prompt' => $this->formatForClaudeCode($prompt),
            'token_estimate'   => $prompt->token_estimate,
            'constraints'      => $prompt->constraints ?? [],
            'success_criteria' => $prompt->success_criteria ?? [],
            'context_files'    => $prompt->context_files ?? [],
        ];
    }

    public function formatForClaudeCode(RepairPrompt $prompt): string
    {
        $parts = [];

        $parts[] = '# System Context';
        $parts[] = '';
        $parts[] = $prompt->system_context;

        $parts[] = '';
        $parts[] = '# Repair Instructions';
        $parts[] = '';
        $parts[] = $prompt->repair_instructions;

        $constraints = $prompt->constraints ?? [];
        if (!empty($constraints)) {
            $parts[] = '';
            $parts[] = '# Constraints';
            $parts[] = '';
            foreach ($constraints as $constraint) {
                $parts[] = '- ' . $constraint;
            }
        }

        $successCriteria = $prompt->success_criteria ?? [];
        if (!empty($successCriteria)) {
            $parts[] = '';
            $parts[] = '# Success Criteria';
            $parts[] = '';
            foreach ($successCriteria as $criterion) {
                $parts[] = '- ' . $criterion;
            }
        }

        return implode("\n", $parts);
    }

    public function markSent(RepairPrompt $prompt): void
    {
        $prompt->update(['sent_at' => now()]);
    }

    public function receiveResponse(
        RepairSession $session,
        RepairPrompt $prompt,
        string $content,
        string $responseType = 'patch'
    ): RepairResponse {
        $type = RepairResponseType::from($responseType);

        return RepairResponse::create([
            'session_id'       => $session->id,
            'prompt_id'        => $prompt->id,
            'response_type'    => $type->value,
            'response_content' => $content,
            'files_modified'   => $this->extractFilePaths($content),
            'confidence_score' => null,
            'requires_review'  => true,
            'received_at'      => now(),
        ]);
    }

    public function extractPatch(RepairResponse $response): ?RepairPatch
    {
        if (!$response->response_type->isPatch()) {
            return null;
        }

        [$linesAdded, $linesRemoved] = $this->countDiffLines($response->response_content);

        $session     = $response->session;
        $patchContent = $response->response_content;
        $patchFormat  = str_contains($patchContent, '@@') ? 'diff' : 'instructions';

        return RepairPatch::create([
            'session_id'    => $session->id,
            'company_id'    => $session->company_id,
            'response_id'   => $response->id,
            'patch_content' => $patchContent,
            'patch_format'  => $patchFormat,
            'files_affected' => $response->files_modified ?? [],
            'lines_added'   => $linesAdded,
            'lines_removed' => $linesRemoved,
            'is_applied'    => false,
            'created_at'    => now(),
        ]);
    }

    private function extractFilePaths(string $content): array
    {
        preg_match_all(
            '/([a-zA-Z0-9_\-\/\.]+\.(?:php|ts|tsx|json|yaml|yml))/',
            $content,
            $matches
        );

        return array_values(array_unique($matches[1]));
    }

    private function countDiffLines(string $content): array
    {
        $added   = 0;
        $removed = 0;

        foreach (explode("\n", $content) as $line) {
            if (str_starts_with($line, '+') && !str_starts_with($line, '+++')) {
                $added++;
            } elseif (str_starts_with($line, '-') && !str_starts_with($line, '---')) {
                $removed++;
            }
        }

        return [max(0, $added), max(0, $removed)];
    }
}
