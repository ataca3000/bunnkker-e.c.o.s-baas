<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\ValueObjects;

/** Immutable configuration for a single stage inside a PipelineTemplate. */
final class StageConfig
{
    private function __construct(
        public readonly string      $handler,      // e.g. 'development_guardian'
        public readonly string      $label,
        public readonly int         $order,
        public readonly bool        $enabled,
        public readonly RetryPolicy $retryPolicy,
        /** @var string[] Action names to run within this stage */
        public readonly array       $actions,
        /** @var array<string, mixed> Stage-specific options */
        public readonly array       $options,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            handler:     (string) ($data['handler']  ?? ''),
            label:       (string) ($data['label']    ?? $data['handler'] ?? ''),
            order:       (int)    ($data['order']    ?? 0),
            enabled:     (bool)   ($data['enabled']  ?? true),
            retryPolicy: isset($data['retry_policy'])
                ? RetryPolicy::fromArray((array) $data['retry_policy'])
                : RetryPolicy::noRetry(),
            actions:     (array)  ($data['actions']  ?? []),
            options:     (array)  ($data['options']  ?? []),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'handler'      => $this->handler,
            'label'        => $this->label,
            'order'        => $this->order,
            'enabled'      => $this->enabled,
            'retry_policy' => $this->retryPolicy->toArray(),
            'actions'      => $this->actions,
            'options'      => $this->options,
        ];
    }
}
