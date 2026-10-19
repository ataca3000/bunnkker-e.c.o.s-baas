import { CheckCircle2, AlertTriangle, XCircle, SkipForward } from 'lucide-react';
import type { CategoryResult, CertStatus } from '../types/engineering';

const CATEGORY_LABELS: Record<string, string> = {
  php:          'PHP',
  laravel:      'Laravel',
  typescript:   'TypeScript',
  eslint:       'ESLint',
  architecture: 'Architecture',
  repository:   'Repository',
  translations: 'Translations',
  docker:       'Docker',
  deployment:   'Deployment',
  security:     'Security',
  performance:  'Performance',
  tech_debt:    'Tech Debt',
};

function StatusIcon({ status }: { status: CertStatus }) {
  switch (status) {
    case 'PASS': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'WARN': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'FAIL': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'SKIP': return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  }
}

interface CategoryStatusGridProps {
  categories: Record<string, CategoryResult>;
}

export function CategoryStatusGrid({ categories }: CategoryStatusGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {Object.entries(categories).map(([key, cat]) => (
        <div
          key={key}
          className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
        >
          <StatusIcon status={cat.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{CATEGORY_LABELS[key] ?? key}</p>
            <p className="text-xs text-muted-foreground">{cat.score}/100 · {cat.weight}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}
