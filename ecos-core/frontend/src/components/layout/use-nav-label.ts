import { useTranslation } from 'react-i18next';

import type { NavGroupKey, NavItemKey } from '@/config/module-navigation';

/**
 * Resolves navigation labels from the localization layer.
 *
 * Navigation labels live in `common.nav.groups` (one entry per module id) and
 * `common.nav.items` (one entry per item key). Those keys are the source of
 * truth; the navigation config carries structure — id, path, icon — and no
 * display text at all.
 *
 * The two key spaces are disjoint and each resolver takes only its own, so a
 * module id can never be looked up as an item key. `findNavItemByPath` reports
 * which space it matched, and the caller picks the resolver accordingly.
 */
export function useNavLabel() {
  const { t } = useTranslation('common');

  const group = (moduleId: NavGroupKey): string => t(($) => $.nav.groups[moduleId]);

  const item = (key: NavItemKey): string => t(($) => $.nav.items[key]);

  return { group, item };
}
