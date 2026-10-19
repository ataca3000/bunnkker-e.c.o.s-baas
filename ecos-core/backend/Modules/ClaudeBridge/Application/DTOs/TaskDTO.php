<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Application\DTOs;

use Modules\ClaudeBridge\Domain\Enums\TaskPriority;
use Modules\ClaudeBridge\Domain\Enums\TaskStatus;

final readonly class TaskDTO
{
    public function __construct(
        public string $companyId,
        public string $createdByUserId,
        public string $title,
        public string $description,
        public string $repositoryPath,
        public string $targetBranch,
        public TaskStatus $status,
        public TaskPriority $priority,
    ) {}

    public static function fromRequest(array $data, string $companyId, string $userId): self
    {
        return new self(
            companyId: $companyId,
            createdByUserId: $userId,
            title: $data['title'],
            description: $data['description'],
            repositoryPath: $data['repository_path'],
            targetBranch: $data['target_branch'] ?? 'main',
            status: TaskStatus::Pending,
            priority: TaskPriority::from($data['priority'] ?? 'normal'),
        );
    }
}
