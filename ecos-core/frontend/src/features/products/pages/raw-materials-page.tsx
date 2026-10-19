// Route shim — keep existing import path working after the workspace was moved to
// features/raw-materials/. The router imports this file by path, so we re-export
// the real implementation without touching router.ts.
export { RawMaterialsPage } from '@/features/raw-materials/pages/raw-materials-page';
