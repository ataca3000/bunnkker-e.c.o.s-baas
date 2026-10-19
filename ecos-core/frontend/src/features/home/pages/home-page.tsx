import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/lib/env';
import { ROUTES } from '@/router/routes';

/**
 * Public landing placeholder (route `/`).
 */
export function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{env.appName}</CardTitle>
            <Badge variant="secondary">Foundation</Badge>
          </div>
          <CardDescription>The enterprise frontend foundation is ready.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to={ROUTES.login}>Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={ROUTES.dashboard}>Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
