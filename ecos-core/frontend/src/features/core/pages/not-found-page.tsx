import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/router/routes';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4 text-center">
      <div>
        <p className="text-8xl font-bold text-muted-foreground/20 leading-none select-none">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          Go back
        </Button>
        <Button onClick={() => navigate(ROUTES.dashboard)}>
          <LayoutDashboard className="size-4" />
          Dashboard
        </Button>
      </div>
    </div>
  );
}
