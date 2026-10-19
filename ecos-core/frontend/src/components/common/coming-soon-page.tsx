import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { findNavItemByPath } from '@/config/module-navigation';
import { useNavLabel } from '@/components/layout/use-nav-label';

/**
 * Generic placeholder page reused by every module route. Derives the module
 * name from the active navigation item, so a single component serves all
 * "Coming Soon" routes (no duplicated page code).
 */
export function ComingSoonPage() {
  const { pathname } = useLocation();
  const navLabel = useNavLabel();
  const navItem = findNavItemByPath(pathname);
  const moduleName = navItem
    ? navItem.kind === 'item'
      ? navLabel.item(navItem.key)
      : navLabel.group(navItem.id)
    : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{moduleName}</h1>
          <p className="text-muted-foreground text-sm">{moduleName} module workspace</p>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>

      <Card>
        <CardHeader className="items-center text-center">
          <span className="bg-muted text-muted-foreground mb-2 flex size-12 items-center justify-center rounded-full">
            <Construction className="size-6" />
          </span>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            The {moduleName} module is not available yet. This is a placeholder within the ECOS
            application shell.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
