import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/providers/app-providers';
import { router } from '@/router/router';

/**
 * Application root: global providers + the router.
 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
