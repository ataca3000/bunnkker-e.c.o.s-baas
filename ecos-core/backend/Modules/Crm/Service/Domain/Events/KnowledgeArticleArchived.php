<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Events;

use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;

/**
 * A knowledge article was withdrawn.
 *
 * Publisher : KnowledgeBaseService::archive
 * Trigger   : An article is archived.
 */
final class KnowledgeArticleArchived extends CrmDomainEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $articleId,
        public readonly ?string $title = null,
        public readonly ?int $actorId = null,
    ) {
        parent::__construct();
    }

    public function eventName(): string
    {
        return 'crm.knowledge_article.archived';
    }

    /** @return array<string, mixed> */
    protected function payload(): array
    {
        return [
            'company_id' => $this->companyId,
            'article_id' => $this->articleId,
            'title' => $this->title,
            'actor_id' => $this->actorId,
        ];
    }
}
