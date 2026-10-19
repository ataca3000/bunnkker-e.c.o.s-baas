import { useLocation } from 'react-router-dom';

import { findModuleByPath, type AppModule } from '@/config/module-navigation';

export function useActiveModule(): AppModule | undefined {
  const { pathname } = useLocation();
  return findModuleByPath(pathname);
}
